import path from "node:path";
import { withFileLock } from "openclaw/plugin-sdk/file-lock";
import { readJsonFileWithFallback, writeJsonFileAtomically } from "openclaw/plugin-sdk/json-store";
import { resolveWorkspaceContext } from "./context.js";

export type SgModelMode = "auto" | "cheap" | "medium" | "expensive";
export type SgModelTier = Exclude<SgModelMode, "auto">;
export type SgModelRouterActivation = "off" | "shadow" | "active";
export type SgModelCapability = "text" | "attachments" | "code" | "long-context";

export type SgModelRoute = {
  provider: string;
  model: string;
  tier: SgModelTier;
  capabilities: readonly SgModelCapability[];
  enabled: boolean;
  priority: number;
};

export type SgModelAssessment = {
  tier: SgModelTier;
  score: number;
  reasons: readonly string[];
};

type SgModelPreference = {
  globalId: string;
  mode: SgModelMode;
  updatedAt: string;
};

type SgModelPreferenceStore = {
  version: 1;
  preferences: SgModelPreference[];
};

type RouterCommandContext = {
  channel: string;
  accountId?: string;
  senderId?: string;
  args?: string;
  config: { session?: { identityLinks?: Record<string, string[]> } };
};

type RouterCommand = {
  name: string;
  description: string;
  acceptsArgs: boolean;
  requireAuth: boolean;
  handler(ctx: RouterCommandContext): Promise<{ text: string }>;
};

type RouterApi = {
  config?: { session?: { identityLinks?: Record<string, string[]> } };
  runtime?: {
    subagent?: {
      getSessionMessages(params: {
        sessionKey: string;
        limit: number;
      }): Promise<{ messages: unknown[] }>;
    };
  };
  on(
    hookName: "before_model_resolve",
    handler: (
      event: RouterModelResolveEvent,
      ctx: RouterModelResolveContext,
    ) => Promise<RouterModelResolveResult | undefined> | RouterModelResolveResult | undefined,
  ): void;
  registerCommand(command: RouterCommand): void;
  logger?: { info(message: string): void; warn(message: string): void };
};

type RouterAttachment = {
  kind: "image" | "video" | "audio" | "document" | "other";
  mimeType?: string;
};

type RouterModelResolveEvent = {
  prompt: string;
  attachments?: readonly RouterAttachment[];
};

type RouterModelResolveContext = {
  channel?: string;
  messageProvider?: string;
  accountId?: string;
  senderId?: string;
  sessionKey?: string;
  runId?: string;
  trigger?: string;
  channelId?: string;
  chatId?: string;
  conversationId?: string;
  to?: string;
  channelContext?: { chat?: { id?: string } };
};

type RouterModelResolveResult = {
  providerOverride?: string;
  modelOverride?: string;
};

const ROUTES: readonly SgModelRoute[] = [
  {
    provider: "openai",
    model: "gpt-5.6-luna",
    tier: "cheap",
    capabilities: ["text", "code"],
    enabled: true,
    priority: 100,
  },
  {
    provider: "openai",
    model: "gpt-5.6-terra",
    tier: "medium",
    capabilities: ["text", "attachments", "code", "long-context"],
    enabled: true,
    priority: 100,
  },
  {
    provider: "openai",
    model: "gpt-5.6-sol",
    tier: "expensive",
    capabilities: ["text", "attachments", "code", "long-context"],
    enabled: true,
    priority: 100,
  },
];

const LOCK_OPTIONS = {
  retries: { retries: 50, factor: 1.2, minTimeout: 10, maxTimeout: 100, randomize: true },
  stale: 30_000,
  staleRecovery: "fail-closed" as const,
};

const emptyStore = (): SgModelPreferenceStore => ({ version: 1, preferences: [] });
const isMode = (value: unknown): value is SgModelMode =>
  value === "auto" || value === "cheap" || value === "medium" || value === "expensive";

function normalizeStore(value: unknown): SgModelPreferenceStore | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const candidate = value as { version?: unknown; preferences?: unknown };
  if (candidate.version !== 1 || !Array.isArray(candidate.preferences)) {
    return undefined;
  }
  const preferences: SgModelPreference[] = [];
  const seen = new Set<string>();
  for (const item of candidate.preferences) {
    if (!item || typeof item !== "object") {
      return undefined;
    }
    const preference = item as Partial<SgModelPreference>;
    if (
      typeof preference.globalId !== "string" ||
      !preference.globalId.trim() ||
      !isMode(preference.mode) ||
      typeof preference.updatedAt !== "string" ||
      Number.isNaN(Date.parse(preference.updatedAt)) ||
      seen.has(preference.globalId)
    ) {
      return undefined;
    }
    seen.add(preference.globalId);
    preferences.push({
      globalId: preference.globalId,
      mode: preference.mode,
      updatedAt: preference.updatedAt,
    });
  }
  return { version: 1, preferences };
}

export class SgModelPreferenceRegistry {
  private readonly filePath: string;

  constructor(stateDir: string) {
    this.filePath = path.join(stateDir, "sg", "model-routing.json");
  }

  private async read(): Promise<SgModelPreferenceStore> {
    const result = await readJsonFileWithFallback<unknown>(this.filePath, emptyStore());
    if (!result.exists) {
      return emptyStore();
    }
    const store = normalizeStore(result.value);
    if (!store) {
      throw new Error("sg-model-routing-store-invalid");
    }
    return store;
  }

  async get(globalId: string): Promise<SgModelMode> {
    return (
      (await this.read()).preferences.find((item) => item.globalId === globalId.trim())?.mode ??
      "auto"
    );
  }

  async set(globalId: string, mode: SgModelMode): Promise<void> {
    const normalizedGlobalId = globalId.trim();
    if (!normalizedGlobalId || !isMode(mode)) {
      throw new Error("sg-model-routing-preference-invalid");
    }
    await withFileLock(this.filePath, LOCK_OPTIONS, async () => {
      const store = await this.read();
      const preference = store.preferences.find((item) => item.globalId === normalizedGlobalId);
      const updatedAt = new Date().toISOString();
      if (preference) {
        preference.mode = mode;
        preference.updatedAt = updatedAt;
      } else {
        store.preferences.push({ globalId: normalizedGlobalId, mode, updatedAt });
      }
      await writeJsonFileAtomically(this.filePath, store);
    });
  }
}

export class SgModelRegistry {
  private readonly routes: readonly SgModelRoute[];

  constructor(routes: readonly SgModelRoute[] = ROUTES) {
    this.routes = [...routes];
  }

  select(
    tier: SgModelTier,
    requiredCapabilities: readonly SgModelCapability[] = ["text"],
  ): SgModelRoute | undefined {
    return this.routes
      .filter(
        (route) =>
          route.enabled &&
          route.tier === tier &&
          requiredCapabilities.every((capability) => route.capabilities.includes(capability)),
      )
      .toSorted((left, right) => right.priority - left.priority)[0];
  }

  list(): readonly SgModelRoute[] {
    return this.routes.map((route) => ({ ...route, capabilities: [...route.capabilities] }));
  }
}

export function resolveSgModelRouterActivation(
  env: NodeJS.ProcessEnv = process.env,
): SgModelRouterActivation {
  const configured = env.SG_MODEL_ROUTING_ACTIVATION?.trim().toLowerCase();
  return configured === "off" || configured === "active" || configured === "shadow"
    ? configured
    : "shadow";
}

export function assessSgModelTier(params: {
  prompt: string;
  attachments?: readonly RouterAttachment[];
}): SgModelAssessment {
  const prompt = params.prompt.normalize("NFKC").trim();
  const attachments = params.attachments ?? [];
  const length = prompt.replace(/\s+/gu, " ").length;
  const codeFenceCount = (prompt.match(/```/gu) ?? []).length;
  const urlCount = (prompt.match(/https?:\/\/\S+/giu) ?? []).length;
  const stepCount = (prompt.match(/^\s*(?:[-*]|\d+[.)])\s+/gmu) ?? []).length;
  const structuredData =
    /(?:[{[]\s*["'][^\n]{1,80}["']\s*:|\b(?:error|exception)\b[^\n]*\n\s+at\s)/iu.test(prompt);
  const analysisIntent =
    /(?:проанализ|исследу|провед[иі].{0,20}аудит|оцен[иі]|analy[sz]|investigat|audit|evaluate)/iu.test(
      prompt,
    );
  const outcomeIntent =
    /(?:найд[иі].{0,20}риск|предлож[иі].{0,20}план|рекомендац|сравн|find.{0,20}risk|propose.{0,20}plan|recommend|compar)/iu.test(
      prompt,
    );
  const domainCount = [
    /архитектур|architect/iu,
    /безопасност|security/iu,
    /памят|memory/iu,
    /биллинг|оплат|billing/iu,
    /маршрутиз|routing/iu,
    /изоляц|isolation/iu,
  ].filter((pattern) => pattern.test(prompt)).length;
  const requiredCapabilities: SgModelCapability[] = attachments.length ? ["attachments"] : [];
  const reasons: string[] = [];
  let score = 0;

  // A short instruction can still require investigation or a consequential change.
  const consequentialWork =
    /(?:аудит|перевір|проверк|исслед|дослід|уязвим|вразлив|безопасност|безпек|архитектур|архітектур|внедр|впровад|реализ|реаліз|исправ|виправ|разработ|розроб|audit|investigat|vulnerab|security|architect|implement|debug|deploy|déploy|auditoría|seguridad|revisar|implementar|sécurité|prüf|sicherheit|監査|安全|审计|安全)/iu.test(
      prompt,
    );

  if (length >= 6_000) {
    score += 6;
    reasons.push("very-long-prompt");
  } else if (length >= 2_000) {
    score += 3;
    reasons.push("long-prompt");
  } else if (length >= 700) {
    score += 1;
    reasons.push("medium-prompt");
  }
  if (codeFenceCount >= 2 || structuredData) {
    score += length >= 1_200 ? 3 : 1;
    reasons.push("code-or-structured-data");
  }
  if (stepCount >= 8) {
    score += 3;
    reasons.push("many-steps");
  } else if (stepCount >= 3) {
    score += 1;
    reasons.push("multi-step");
  }
  if (urlCount >= 2) {
    score += 2;
    reasons.push("multiple-sources");
  }
  if (attachments.length) {
    score += attachments.some((item) => item.kind === "document" || item.kind === "video") ? 2 : 1;
    reasons.push("attachments");
  }
  if (analysisIntent && outcomeIntent && domainCount >= 2) {
    score += 5;
    reasons.push("multi-domain-analysis");
  }

  if (score >= 5) {
    return { tier: "expensive", score, reasons };
  }
  if (consequentialWork) {
    return { tier: "medium", score, reasons: ["consequential-work"] };
  }
  const isBoundedSimpleRequest =
    length > 0 &&
    length <= 180 &&
    codeFenceCount === 0 &&
    urlCount === 0 &&
    stepCount <= 1 &&
    !structuredData &&
    requiredCapabilities.length === 0;
  if (isBoundedSimpleRequest) {
    return { tier: "cheap", score, reasons: reasons.length ? reasons : ["bounded-short-request"] };
  }
  return { tier: "medium", score, reasons: reasons.length ? reasons : ["conservative-default"] };
}

function isShortContinuation(prompt: string): boolean {
  return /^(?:да|так|продолжай|продовжуй|проверь|перевір|дальше|далі|yes|ok|continue|go on|check|verify|sigue|continúa|continuer|vérifie|weiter|prüfe|继续|检查)[.!?。\s]*$/iu.test(
    prompt.normalize("NFKC").trim(),
  );
}

function isDirectSessionKey(sessionKey: string | undefined): sessionKey is string {
  return typeof sessionKey === "string" && /:(?:direct|dm):/iu.test(sessionKey);
}

function previousUserPrompt(messages: unknown[], currentPrompt: string): string | undefined {
  for (const message of messages.toReversed()) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      continue;
    }
    const record = message as { role?: unknown; content?: unknown };
    if (record.role !== "user") {
      continue;
    }
    const content = record.content;
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
              .filter(
                (part): part is { type: "text"; text: string } =>
                  part?.type === "text" && typeof part.text === "string",
              )
              .map((part) => part.text)
              .join(" ")
          : "";
    if (text && text.trim() !== currentPrompt.trim() && !isShortContinuation(text)) {
      return text.slice(0, 8_000);
    }
  }
  return undefined;
}

function formatRoute(route: SgModelRoute | undefined): string {
  return route ? `${route.provider}/${route.model}` : "маршрут недоступен";
}

export function registerSgModelRouter(params: {
  api: RouterApi;
  stateDir: string;
  env?: NodeJS.ProcessEnv;
  registry?: SgModelRegistry;
}): void {
  const { api, stateDir } = params;
  const activation = resolveSgModelRouterActivation(params.env);
  const registry = params.registry ?? new SgModelRegistry();
  const preferences = new SgModelPreferenceRegistry(stateDir);

  api.registerCommand({
    name: "sg_model",
    description: "Выбрать режим маршрутизации моделей SG",
    acceptsArgs: true,
    requireAuth: false,
    handler: async (ctx) => {
      const identity = await resolveWorkspaceContext(
        {
          channel: ctx.channel,
          accountId: ctx.accountId,
          senderId: ctx.senderId,
          identityLinks: ctx.config.session?.identityLinks,
        },
        stateDir,
      );
      if (!identity.globalId) {
        return { text: "SG MODEL — Global ID не найден" };
      }
      const requested = ctx.args?.trim().toLowerCase() || "status";
      if (requested !== "status" && !isMode(requested)) {
        return { text: "SG MODEL — используй: auto, cheap, medium, expensive или status" };
      }
      if (requested !== "status") {
        await preferences.set(identity.globalId, requested);
      }
      const mode = requested === "status" ? await preferences.get(identity.globalId) : requested;
      const route = mode === "auto" ? undefined : registry.select(mode);
      return {
        text: [
          "SG MODEL",
          `Активация: ${activation}`,
          `Режим: ${mode}`,
          `Модель: ${mode === "auto" ? "автоматический выбор для каждого запроса" : formatRoute(route)}`,
        ].join("\n"),
      };
    },
  });

  api.on("before_model_resolve", async (event, ctx) => {
    if (activation === "off") {
      return;
    }
    if (ctx.trigger && ctx.trigger !== "user") {
      api.logger?.info(
        `[sg-model-router] decision=retain trigger=${ctx.trigger} reason=non-user-run`,
      );
      return;
    }
    const channel = ctx.channel ?? ctx.messageProvider;
    if (!channel || !ctx.senderId) {
      api.logger?.warn("[sg-model-router] decision=retain reason=trusted-identity-missing");
      return;
    }
    try {
      const identity = await resolveWorkspaceContext(
        {
          channel,
          accountId: ctx.accountId,
          senderId: ctx.senderId,
          identityLinks: api.config?.session?.identityLinks,
        },
        stateDir,
      );
      if (!identity.globalId) {
        api.logger?.warn("[sg-model-router] decision=retain reason=global-id-missing");
        return;
      }
      const mode = await preferences.get(identity.globalId);
      if (!event.prompt.trim()) {
        api.logger?.warn(
          `[sg-model-router] decision=retain activation=${activation} mode=${mode} reason=prompt-empty`,
        );
        return;
      }
      let assessment = assessSgModelTier(event);
      if (mode === "auto" && isShortContinuation(event.prompt)) {
        // The hook has no history. Read only the current native session when needed.
        let prior: string | undefined;
        if (isDirectSessionKey(ctx.sessionKey) && api.runtime?.subagent?.getSessionMessages) {
          try {
            const history = await api.runtime.subagent.getSessionMessages({
              sessionKey: ctx.sessionKey,
              limit: 8,
            });
            prior = previousUserPrompt(history.messages, event.prompt);
          } catch {
            api.logger?.warn("[sg-model-router] continuation-history-unavailable");
          }
        }
        const priorTier = prior ? assessSgModelTier({ prompt: prior }).tier : "medium";
        assessment = {
          tier: priorTier === "cheap" ? "medium" : priorTier,
          score: 0,
          reasons: [prior ? "session-continuation" : "continuation-context-unavailable"],
        };
      }
      const tier = mode === "auto" ? assessment.tier : mode;
      const requiredCapabilities: SgModelCapability[] = event.attachments?.length
        ? ["text", "attachments"]
        : ["text"];
      const route = registry.select(tier, requiredCapabilities);
      if (!route) {
        api.logger?.warn(
          `[sg-model-router] decision=retain activation=${activation} mode=${mode} tier=${tier} reason=route-unavailable`,
        );
        return;
      }
      api.logger?.info(
        `[sg-model-router] decision=${activation === "active" ? "override" : "shadow"} mode=${mode} tier=${tier} route=${route.provider}/${route.model} reasons=${assessment.reasons.join(",")}`,
      );
      if (activation !== "active") {
        return;
      }
      return { providerOverride: route.provider, modelOverride: route.model };
    } catch (error) {
      api.logger?.warn(
        `[sg-model-router] decision=retain reason=router-error error=${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });
}
