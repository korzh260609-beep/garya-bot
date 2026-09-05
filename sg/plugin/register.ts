import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { SgContentRegistry } from "./content-registry.js";
import { SgContextDiagnostics, type SgContextDiagnosticCommand } from "./context-diagnostics.js";
import { formatWorkspaceContext, resolveWorkspaceContext } from "./context.js";
import { buildSgCostDiagnostic, type SgCostDiagnosticConfig } from "./cost-diagnostics.js";
import { formatWorkspaceResolution, SgWorkspaceRegistry } from "./workspace-registry.js";
import { SgWorkspaceRequestRegistry } from "./workspace-requests.js";
import { createWorkspaceTools, WSP3_AGENT_GUIDANCE } from "./workspace-tools.js";
import { buildWsp5Diagnostic } from "./wsp5-diagnostics.js";
import { Wsp5NativeLifecycle } from "./wsp5-lifecycle.js";
import { createWsp5Tools, WSP5_AGENT_GUIDANCE } from "./wsp5-tools.js";
import { openSgAssessmentStores, SgAssessmentRegistry } from "./wsp6-assessments.js";
import { buildWsp6Diagnostic } from "./wsp6-diagnostics.js";
import { Wsp6InteractiveController } from "./wsp6-interactive.js";
import { Wsp6NativeLifecycle } from "./wsp6-lifecycle.js";
import { createWsp6Tools, WSP6_AGENT_GUIDANCE } from "./wsp6-tools.js";

type CommandContext = {
  channel: string;
  channelId?: string;
  accountId?: string;
  from?: string;
  to?: string;
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  sessionTarget?: SgContextDiagnosticCommand["sessionTarget"];
  args?: string;
  runtimeContext?: SgContextDiagnosticCommand["runtimeContext"];
  threadParentId?: string;
  messageThreadId?: string | number;
  senderId?: string;
  config: SgCostDiagnosticConfig & {
    session?: { dmScope?: string; identityLinks?: Record<string, string[]> };
  };
};

type WorkspacePluginApi = {
  config?: OpenClawPluginApi["config"];
  runtime: {
    state: {
      resolveStateDir(env?: NodeJS.ProcessEnv): string;
    };
    channel?: Pick<OpenClawPluginApi["runtime"]["channel"], "outbound">;
  };
  registerInteractiveHandler?: OpenClawPluginApi["registerInteractiveHandler"];
  registerCommand(command: {
    name: string;
    description: string;
    acceptsArgs?: boolean;
    requireAuth: boolean;
    handler(ctx: CommandContext): Promise<{ text: string }>;
  }): void;
  registerTool(
    factory: (
      ctx: Parameters<typeof createWorkspaceTools>[0],
    ) =>
      | ReturnType<typeof createWorkspaceTools>
      | ReturnType<typeof createWsp5Tools>
      | ReturnType<typeof createWsp6Tools>,
    options: { names: string[] },
  ): void;
  on: OpenClawPluginApi["on"];
  logger?: { info(message: string): void; warn(message: string): void };
};

const ONBOARDING_NOTICE =
  "Я обнаружил новое сообщество и отправил запрос на подключение. Сообщу после подтверждения владельца.";
const PENDING_NOTICE =
  "Запрос на подключение этого сообщества уже ожидает подтверждения владельца.";
const PENDING_TOOL = "sg_workspace_pending";
const WSP5_TOOL_NAMES = [
  "sg_content_draft",
  "sg_content_review",
  "sg_content_publish",
  "sg_content_schedule",
  "sg_content_dispatch",
] as const;
const WSP6_TOOL_NAMES = ["sg_test_manage", "sg_test_attempt", "sg_test_stats"] as const;
const MAX_DIAGNOSTIC_SESSIONS = 100;
const MAX_DURABLE_EVENTS = 100;
const MAX_DURABLE_INSTANCES = 20;
const WSP3_DIAGNOSTIC_VERSION = "wsp3-e2e-v2";

type DiagnosticFact = string | number | boolean;

type DurableDiagnosticStage =
  | "plugin-loaded"
  | "inbound-claim"
  | "before-dispatch-input"
  | "before-dispatch"
  | "prompt-hook"
  | "llm-input"
  | "model-call"
  | "pending-tool-selected"
  | "pending-tool-result"
  | "final-reply"
  | "message-sent"
  | "diagnostic-command";

type DurableDiagnosticEvent = {
  version: 1;
  instanceId: string;
  pid: number;
  startedAt: string;
  recordedAt: string;
  stage: DurableDiagnosticStage;
  sessionHash: string;
  routeHash: string;
  runHash: string;
  messageHash?: string;
  conversationHash?: string;
  diagnosticVersion?: string;
  imageCommit?: string;
  result: string;
  facts?: Record<string, DiagnosticFact>;
};

type DiagnosticHookCounts = {
  prompt: number;
  llmInput: number;
  model: number;
  toolSelected: number;
  toolResult: number;
  reply: number;
};

type Wsp3DiagnosticTrace = {
  runId?: string;
  sessionKey?: string;
  routeKey?: string;
  sequence: number;
  promptHook: boolean;
  pendingToolAllowed?: boolean;
  modelCalls: number;
  pendingToolSelected: boolean;
  pendingToolCompleted: boolean;
  pendingToolResultReadable?: boolean;
  pendingToolResultStatus?: string;
  pendingToolResultCount?: number;
  toolError?: string;
  finalReply: boolean;
};

function newDiagnosticTrace(runId: string | undefined, sequence: number): Wsp3DiagnosticTrace {
  return {
    runId,
    sequence,
    promptHook: false,
    modelCalls: 0,
    pendingToolSelected: false,
    pendingToolCompleted: false,
    finalReply: false,
  };
}

function normalizedRouteKey(params: {
  channel?: string;
  accountId?: string;
  senderId?: string;
}): string | undefined {
  const channel = params.channel?.trim().toLowerCase();
  const senderId = params.senderId?.trim().toLowerCase();
  if (!channel || !senderId) {
    return undefined;
  }
  return `${channel}|${params.accountId?.trim().toLowerCase() || "default"}|${senderId}`;
}

function diagnosticFailure(params: {
  trace?: Wsp3DiagnosticTrace;
  projectRole?: string;
  pendingCount?: number;
  storeError?: string;
}): string {
  if (params.projectRole !== "monarch") {
    return "monarch_identity_not_resolved";
  }
  if (params.storeError) {
    return "pending_store_read_failed";
  }
  if (params.pendingCount === 0) {
    return "pending_store_empty";
  }
  if (!params.trace) {
    return "model_trace_missing";
  }
  if (!params.trace.promptHook) {
    return "prompt_hook_missing";
  }
  if (params.trace.pendingToolAllowed === false) {
    return "pending_tool_not_in_model_surface";
  }
  if (params.trace.modelCalls === 0) {
    return "model_call_not_started";
  }
  if (!params.trace.pendingToolSelected) {
    return "model_did_not_select_pending_tool";
  }
  if (params.trace.toolError) {
    return "pending_tool_execution_failed";
  }
  if (!params.trace.pendingToolCompleted) {
    return "pending_tool_result_missing";
  }
  if (params.trace.pendingToolResultReadable !== true) {
    return "pending_tool_result_invalid";
  }
  if (params.trace.pendingToolResultStatus !== "ok") {
    return `pending_tool_result_${params.trace.pendingToolResultStatus ?? "unknown"}`;
  }
  if (params.trace.pendingToolResultCount !== params.pendingCount) {
    return "pending_tool_result_store_mismatch";
  }
  if (!params.trace.finalReply) {
    return "final_reply_not_observed";
  }
  return "none";
}

function canonicalResourceId(channel: string, conversationId: string): string {
  const normalizedChannel = channel.trim().toLowerCase();
  const normalizedConversationId = conversationId.trim();
  return normalizedConversationId.toLowerCase().startsWith(`${normalizedChannel}:`)
    ? normalizedConversationId
    : `${normalizedChannel}:${normalizedConversationId}`;
}

function traceIdFor(messageId: string | undefined): string {
  return createHash("sha256")
    .update(messageId ?? "missing-message-id")
    .digest("hex")
    .slice(0, 12);
}

function diagnosticTextClass(value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    return "missing";
  }
  if (/^\/new(?:@[\w_]+)?(?:\s|$)/iu.test(normalized)) {
    return "slash-new";
  }
  if (/^\/[\w_]+(?:@[\w_]+)?(?:\s|$)/u.test(normalized)) {
    return "slash-command";
  }
  if (/(?:^|\n)\/new(?:@[\w_]+)?(?:\s|$)/iu.test(normalized)) {
    return "embedded-new";
  }
  if (normalized === PENDING_NOTICE) {
    return "pending-notice";
  }
  if (normalized === ONBOARDING_NOTICE) {
    return "onboarding-notice";
  }
  if (normalized === "✅ New session started.") {
    return "new-session-ack";
  }
  if (normalized === "✅ Session reset.") {
    return "reset-ack";
  }
  return "other";
}

function diagnosticSessionLane(sessionKey: string | undefined): string {
  if (!sessionKey) {
    return "missing";
  }
  for (const lane of ["slash", "group", "direct", "dm", "channel"] as const) {
    if (sessionKey.includes(`:${lane}:`)) {
      return lane;
    }
  }
  return "other";
}

function formatDiagnosticFacts(event: DurableDiagnosticEvent | undefined): string {
  if (!event?.facts) {
    return "none";
  }
  return Object.entries(event.facts)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(",");
}

function trace(api: WorkspacePluginApi, traceId: string, stage: string, result?: string): void {
  api.logger?.info(
    `[sg-workspace] trace=${traceId} stage=${stage}${result ? ` result=${result}` : ""}`,
  );
}

export function registerWorkspaceManager(api: WorkspacePluginApi): void {
  api.logger?.info("[sg-workspace] stage=register-workspace-manager");
  const stateDir =
    process.env.OPENCLAW_STATE_DIR?.trim() || api.runtime.state.resolveStateDir(process.env);
  const wsp5Lifecycle = new Wsp5NativeLifecycle(new SgContentRegistry(stateDir), api.logger);
  let assessments: SgAssessmentRegistry | undefined;
  const resolveAssessments = () => {
    if (assessments) {
      return assessments;
    }
    assessments = new SgAssessmentRegistry(openSgAssessmentStores(stateDir));
    return assessments;
  };
  const wsp6Lifecycle = new Wsp6NativeLifecycle(api.logger);
  const wsp6Interactive = api.registerInteractiveHandler
    ? new Wsp6InteractiveController(stateDir, resolveAssessments, {
        config: api.config,
        registerInteractiveHandler: api.registerInteractiveHandler,
        loadOutboundAdapter: (channelId) => {
          const channelRuntime = api.runtime.channel;
          if (!channelRuntime) {
            throw new Error("sg-test-channel-runtime-unavailable");
          }
          return channelRuntime.outbound.loadAdapter(channelId);
        },
        logger: api.logger,
      })
    : undefined;
  wsp6Interactive?.register();
  const contextDiagnostics = new SgContextDiagnostics(stateDir, api);
  contextDiagnostics.register();
  api.logger?.info("[sg-workspace] stage=resolve-state-dir");
  const diagnosticInstanceId = randomUUID();
  const diagnosticStartedAt = new Date().toISOString();
  const diagnosticDirectory = path.join(stateDir, "sg-workspace-diagnostics");
  const diagnosticFile = path.join(
    diagnosticDirectory,
    `wsp3-${Date.now()}-${process.pid}-${diagnosticInstanceId}.json`,
  );
  const durableEvents: DurableDiagnosticEvent[] = [];
  let durableWriteQueue: Promise<void> = Promise.resolve();
  const recordDurableDiagnostic = (params: {
    stage: DurableDiagnosticStage;
    sessionKey?: string;
    routeKey?: string;
    runId?: string;
    messageId?: string;
    conversationId?: string;
    result: string;
    facts?: Record<string, DiagnosticFact>;
  }): Promise<void> => {
    durableWriteQueue = durableWriteQueue
      .then(async () => {
        durableEvents.push({
          version: 1,
          instanceId: diagnosticInstanceId,
          pid: process.pid,
          startedAt: diagnosticStartedAt,
          recordedAt: new Date().toISOString(),
          stage: params.stage,
          sessionHash: traceIdFor(params.sessionKey),
          routeHash: traceIdFor(params.routeKey),
          runHash: traceIdFor(params.runId),
          ...(params.messageId ? { messageHash: traceIdFor(params.messageId) } : {}),
          ...(params.conversationId ? { conversationHash: traceIdFor(params.conversationId) } : {}),
          diagnosticVersion: WSP3_DIAGNOSTIC_VERSION,
          imageCommit: process.env.SG22_IMAGE_COMMIT?.trim() || "unknown",
          result: params.result,
          facts: params.facts,
        });
        if (durableEvents.length > MAX_DURABLE_EVENTS) {
          durableEvents.shift();
        }
        await mkdir(diagnosticDirectory, { recursive: true });
        const temporaryFile = `${diagnosticFile}.tmp`;
        await writeFile(temporaryFile, JSON.stringify(durableEvents), "utf8");
        await rename(temporaryFile, diagnosticFile);
      })
      .catch((error: unknown) => {
        api.logger?.warn(`[sg-wsp3-diag] durable-write-failed error=${String(error)}`);
      });
    return durableWriteQueue;
  };
  const readDurableDiagnostics = async (): Promise<DurableDiagnosticEvent[]> => {
    await durableWriteQueue;
    try {
      const files = (await readdir(diagnosticDirectory))
        .filter((file) => file.startsWith("wsp3-") && file.endsWith(".json"))
        .toSorted()
        .toReversed()
        .slice(0, MAX_DURABLE_INSTANCES);
      const snapshots = await Promise.all(
        files.map(async (file) => {
          try {
            const parsed: unknown = JSON.parse(
              await readFile(path.join(diagnosticDirectory, file), "utf8"),
            );
            return Array.isArray(parsed)
              ? parsed.filter(
                  (event): event is DurableDiagnosticEvent =>
                    Boolean(event) &&
                    typeof event === "object" &&
                    (event as { version?: unknown }).version === 1 &&
                    typeof (event as { stage?: unknown }).stage === "string",
                )
              : [];
          } catch {
            return [];
          }
        }),
      );
      return snapshots.flat();
    } catch {
      return [];
    }
  };
  void recordDurableDiagnostic({ stage: "plugin-loaded", result: "ok" });
  const registry = new SgWorkspaceRegistry(stateDir);
  const requests = new SgWorkspaceRequestRegistry(stateDir);
  const diagnosticTraces: Wsp3DiagnosticTrace[] = [];
  const hookCounts: DiagnosticHookCounts = {
    prompt: 0,
    llmInput: 0,
    model: 0,
    toolSelected: 0,
    toolResult: 0,
    reply: 0,
  };
  let diagnosticSequence = 0;
  const updateDiagnostic = (
    identity: { sessionKey?: string; routeKey?: string },
    runId: string | undefined,
    update: (trace: Wsp3DiagnosticTrace) => void,
  ) => {
    if (!identity.sessionKey && !identity.routeKey && !runId) {
      return;
    }
    let current = diagnosticTraces
      .toReversed()
      .find(
        (candidate) =>
          (runId && candidate.runId === runId) ||
          (identity.sessionKey && candidate.sessionKey === identity.sessionKey) ||
          (identity.routeKey && candidate.routeKey === identity.routeKey),
      );
    if (!current || (runId && current.runId && current.runId !== runId)) {
      current = newDiagnosticTrace(runId, ++diagnosticSequence);
      diagnosticTraces.push(current);
      if (diagnosticTraces.length > MAX_DIAGNOSTIC_SESSIONS) {
        diagnosticTraces.shift();
      }
    }
    current.runId ??= runId;
    current.sessionKey ??= identity.sessionKey;
    current.routeKey ??= identity.routeKey;
    update(current);
  };
  const diagnosticLog = (
    sessionKey: string | undefined,
    runId: string | undefined,
    stage: string,
    result: string,
  ) => {
    api.logger?.info(
      `[sg-wsp3-diag] session=${traceIdFor(sessionKey)} run=${traceIdFor(runId)} stage=${stage} result=${result}`,
    );
  };
  api.on("inbound_claim", async (event, ctx) => {
    const routeKey = normalizedRouteKey({
      channel: event.channel,
      accountId: event.accountId ?? ctx.accountId,
      senderId: event.senderId ?? ctx.senderId,
    });
    await recordDurableDiagnostic({
      stage: "inbound-claim",
      sessionKey: event.sessionKey ?? ctx.sessionKey,
      routeKey,
      runId: event.runId ?? ctx.runId,
      messageId: event.messageId ?? ctx.messageId,
      conversationId: event.conversationId ?? ctx.conversationId,
      result: "observed",
      facts: {
        group: event.isGroup,
        lane: diagnosticSessionLane(event.sessionKey ?? ctx.sessionKey),
        content: diagnosticTextClass(event.content),
        body: diagnosticTextClass(event.body),
        bodyForAgent: diagnosticTextClass(event.bodyForAgent),
        authorized: event.commandAuthorized ?? "unknown",
      },
    });
  });
  api.on("message_sent", async (event, ctx) => {
    const replyClass = diagnosticTextClass(event.content);
    if (replyClass === "other" && event.success && event.error === undefined) {
      return;
    }
    await recordDurableDiagnostic({
      stage: "message-sent",
      sessionKey: event.sessionKey ?? ctx.sessionKey,
      runId: event.runId ?? ctx.runId,
      messageId: event.messageId ?? ctx.messageId,
      conversationId: ctx.conversationId,
      result: event.success ? replyClass : "delivery-failed",
      facts: {
        success: event.success,
        reply: replyClass,
        lane: diagnosticSessionLane(event.sessionKey ?? ctx.sessionKey),
        error: event.error ? "present" : "none",
      },
    });
  });
  api.logger?.info("[sg-workspace] stage=register-tools");
  api.registerTool((ctx) => createWorkspaceTools(ctx, stateDir), {
    names: ["sg_workspace_onboard", "sg_workspace_pending", "sg_workspace_decide"],
  });
  api.registerTool((ctx) => createWsp5Tools(ctx, stateDir, wsp5Lifecycle), {
    names: [...WSP5_TOOL_NAMES],
  });
  api.registerTool((ctx) => createWsp6Tools(ctx, stateDir, resolveAssessments(), wsp6Lifecycle), {
    names: [...WSP6_TOOL_NAMES],
  });
  wsp5Lifecycle.register(api);
  wsp6Lifecycle.register(api);
  api.logger?.info("[sg-workspace] stage=register-tools-complete");
  api.on("before_prompt_build", async (_event, ctx) => {
    hookCounts.prompt += 1;
    let identityContext = [
      "SG Workspace Manager — WSP1 (read-only)",
      "Global ID: не найден",
      "Роль SG: не определена",
    ].join("\n");
    try {
      identityContext = formatWorkspaceContext(
        await resolveWorkspaceContext(
          {
            channel: ctx.channel ?? ctx.messageProvider ?? "",
            accountId: ctx.accountId,
            to: ctx.conversationId,
            senderId: ctx.senderId,
            identityLinks: api.config?.session?.identityLinks,
          },
          stateDir,
        ),
      );
    } catch (error) {
      api.logger?.warn(
        `[sg-workspace] identity resolution failed safely: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const routeKey = normalizedRouteKey({
      channel: ctx.channel ?? ctx.messageProvider,
      accountId: ctx.accountId,
      senderId: ctx.senderId,
    });
    updateDiagnostic(
      {
        sessionKey: ctx.sessionKey,
        routeKey,
      },
      ctx.runId,
      (current) => {
        current.promptHook = true;
        current.pendingToolAllowed = undefined;
      },
    );
    await recordDurableDiagnostic({
      stage: "prompt-hook",
      sessionKey: ctx.sessionKey,
      routeKey,
      runId: ctx.runId,
      result: "guidance-injected",
    });
    diagnosticLog(ctx.sessionKey, ctx.runId, "prompt-hook", "guidance-injected");
    return {
      prependSystemContext: `${identityContext}\n\n${WSP3_AGENT_GUIDANCE}\n${WSP5_AGENT_GUIDANCE}\n${WSP6_AGENT_GUIDANCE}`,
    };
  });
  api.on("llm_input", async (event, ctx) => {
    hookCounts.llmInput += 1;
    const routeKey = normalizedRouteKey({
      channel: ctx.channel ?? ctx.messageProvider,
      accountId: ctx.accountId,
      senderId: ctx.senderId,
    });
    const pendingToolAllowed =
      event.tools?.some(
        (tool) =>
          Boolean(tool) &&
          typeof tool === "object" &&
          (tool as { name?: unknown }).name === PENDING_TOOL,
      ) === true;
    updateDiagnostic(
      { sessionKey: ctx.sessionKey, routeKey },
      ctx.runId ?? event.runId,
      (current) => {
        current.pendingToolAllowed = pendingToolAllowed;
      },
    );
    await recordDurableDiagnostic({
      stage: "llm-input",
      sessionKey: ctx.sessionKey,
      routeKey,
      runId: ctx.runId ?? event.runId,
      result: pendingToolAllowed ? "pending-tool-present" : "pending-tool-missing",
    });
    diagnosticLog(
      ctx.sessionKey,
      ctx.runId ?? event.runId,
      "llm-input",
      pendingToolAllowed ? "pending-tool-present" : "pending-tool-missing",
    );
  });
  api.on("model_call_started", async (event, ctx) => {
    hookCounts.model += 1;
    const runId = ctx.runId ?? event.runId;
    const sessionKey = ctx.sessionKey ?? event.sessionKey;
    const routeKey = normalizedRouteKey({
      channel: ctx.channel ?? ctx.messageProvider,
      accountId: ctx.accountId,
      senderId: ctx.senderId,
    });
    updateDiagnostic(
      {
        sessionKey,
        routeKey,
      },
      runId,
      (current) => {
        current.modelCalls += 1;
      },
    );
    await recordDurableDiagnostic({
      stage: "model-call",
      sessionKey,
      routeKey,
      runId,
      result: "started",
    });
    diagnosticLog(sessionKey, runId, "model-call", "started");
  });
  api.on(
    "before_tool_call",
    async (event, ctx) => {
      hookCounts.toolSelected += 1;
      const runId = ctx.runId ?? event.runId;
      const routeKey = normalizedRouteKey(ctx.requester ?? {});
      updateDiagnostic(
        {
          sessionKey: ctx.sessionKey,
          routeKey,
        },
        runId,
        (current) => {
          current.pendingToolSelected = true;
        },
      );
      await recordDurableDiagnostic({
        stage: "pending-tool-selected",
        sessionKey: ctx.sessionKey,
        routeKey,
        runId,
        result: "selected",
      });
      diagnosticLog(ctx.sessionKey, runId, "pending-tool", "selected");
    },
    { matcher: [PENDING_TOOL] },
  );
  api.on(
    "after_tool_call",
    async (event, ctx) => {
      hookCounts.toolResult += 1;
      const runId = ctx.runId ?? event.runId;
      const routeKey = normalizedRouteKey(ctx.requester ?? {});
      const result =
        event.result && typeof event.result === "object"
          ? (event.result as { details?: unknown })
          : undefined;
      const details =
        result?.details && typeof result.details === "object"
          ? (result.details as { status?: unknown; requests?: unknown })
          : undefined;
      const resultReadable =
        typeof details?.status === "string" &&
        (details.status !== "ok" || Array.isArray(details.requests));
      updateDiagnostic(
        {
          sessionKey: ctx.sessionKey,
          routeKey,
        },
        runId,
        (current) => {
          current.pendingToolCompleted = !event.error;
          current.pendingToolResultReadable = resultReadable;
          current.pendingToolResultStatus =
            typeof details?.status === "string" ? details.status : undefined;
          current.pendingToolResultCount = Array.isArray(details?.requests)
            ? details.requests.length
            : undefined;
          current.toolError = event.error;
        },
      );
      await recordDurableDiagnostic({
        stage: "pending-tool-result",
        sessionKey: ctx.sessionKey,
        routeKey,
        runId,
        result: event.error
          ? "execution-error"
          : resultReadable
            ? `${String(details?.status)}:${Array.isArray(details?.requests) ? details.requests.length : 0}`
            : "invalid-payload",
      });
      diagnosticLog(
        ctx.sessionKey,
        runId,
        "pending-tool-result",
        event.error
          ? "execution-error"
          : resultReadable
            ? `${String(details?.status)}:${Array.isArray(details?.requests) ? details.requests.length : 0}`
            : "invalid-payload",
      );
    },
    { matcher: [PENDING_TOOL] },
  );
  api.on("before_agent_reply", async (event, ctx) => {
    hookCounts.reply += 1;
    const routeKey = normalizedRouteKey({
      channel: ctx.channel ?? ctx.messageProvider,
      accountId: ctx.accountId,
      senderId: ctx.senderId,
    });
    updateDiagnostic(
      {
        sessionKey: ctx.sessionKey,
        routeKey,
      },
      ctx.runId,
      (current) => {
        current.finalReply = Boolean(event.cleanedBody.trim());
      },
    );
    await recordDurableDiagnostic({
      stage: "final-reply",
      sessionKey: ctx.sessionKey,
      routeKey,
      runId: ctx.runId,
      result: event.cleanedBody.trim() ? "present" : "empty",
    });
    diagnosticLog(
      ctx.sessionKey,
      ctx.runId,
      "final-reply",
      event.cleanedBody.trim() ? "present" : "empty",
    );
  });
  api.logger?.info("[sg-workspace] stage=register-before-dispatch");
  api.on("before_dispatch", async (event, ctx) => {
    const traceId = traceIdFor(ctx.messageId);
    const messageId = ctx.messageId ?? event.messageId;
    const conversationId = ctx.conversationId;
    const routeKey = normalizedRouteKey({
      channel: ctx.channelId ?? event.channel,
      accountId: ctx.accountId,
      senderId: ctx.senderId ?? event.senderId,
    });
    const slashLane = ctx.sessionKey?.includes(":slash:") === true;
    const contentClass = diagnosticTextClass(event.content);
    const bodyClass = diagnosticTextClass(event.body);
    const slashText = (event.body ?? event.content)?.trimStart().startsWith("/") === true;
    const decisionFacts: Record<string, DiagnosticFact> = {
      group: event.isGroup ?? "unknown",
      lane: diagnosticSessionLane(ctx.sessionKey ?? event.sessionKey),
      content: contentClass,
      body: bodyClass,
      slashLane,
      slashText,
      conversation: conversationId ? "present" : "missing",
    };
    await recordDurableDiagnostic({
      stage: "before-dispatch-input",
      sessionKey: ctx.sessionKey ?? event.sessionKey,
      routeKey,
      messageId,
      conversationId,
      result: "observed",
      facts: { ...decisionFacts },
    });
    const recordDispatchOutcome = async (result: string) => {
      await recordDurableDiagnostic({
        stage: "before-dispatch",
        sessionKey: ctx.sessionKey ?? event.sessionKey,
        routeKey,
        messageId,
        conversationId,
        result,
        facts: { ...decisionFacts },
      });
      diagnosticLog(ctx.sessionKey, undefined, "before-dispatch", result);
    };
    trace(api, traceId, "hook-enter");
    if (event.isGroup !== true || slashLane || slashText) {
      trace(api, traceId, "context-check", "not-applicable");
      trace(api, traceId, "dispatch-handle", "false");
      await recordDispatchOutcome(
        event.isGroup !== true ? "direct-chat-bypassed" : "system-command-bypassed",
      );
      return { handled: false };
    }
    const channel = ctx.channelId ?? event.channel;
    const senderId = ctx.senderId ?? event.senderId;
    const missingContext = [
      !channel ? "channelId" : undefined,
      !ctx.conversationId ? "conversationId" : undefined,
      !senderId ? "senderId" : undefined,
    ].filter((field): field is string => field !== undefined);
    if (missingContext.length > 0) {
      trace(api, traceId, "context-check", `missing-${missingContext.join("-")}`);
      api.logger?.warn(
        `SG workspace automatic onboarding skipped: missing ${missingContext.join(",")}`,
      );
      await recordDispatchOutcome(`missing-${missingContext.join("-")}`);
      return { handled: false };
    }
    trace(api, traceId, "context-check", "valid");
    let dispatchOutcome = "unregistered-no-actor";
    try {
      const resourceId = canonicalResourceId(channel, ctx.conversationId);
      const resource = {
        platform: channel,
        accountId: ctx.accountId,
        resourceId,
      };
      const workspace = await registry.resolve(resource);
      decisionFacts.workspace = workspace?.status ?? "missing";
      dispatchOutcome = workspace ? `workspace-${workspace.status}` : dispatchOutcome;
      trace(api, traceId, "workspace-lookup", workspace ? "found" : "missing");
      const request = workspace ? undefined : await requests.resolve(resource);
      decisionFacts.request = request?.status ?? "missing";
      trace(api, traceId, "request-lookup", request ? "found" : "missing");
      if (!workspace && request?.status === "pending") {
        trace(api, traceId, "pending-create", "existing");
        trace(api, traceId, "dispatch-handle", "true");
        await recordDispatchOutcome("pending-existing");
        return { handled: true, text: PENDING_NOTICE };
      }
      if (!workspace && !request) {
        const actor = await resolveWorkspaceContext(
          {
            channel,
            accountId: ctx.accountId,
            to: resourceId,
            senderId,
            identityLinks: api.config?.session?.identityLinks,
          },
          stateDir,
        );
        trace(api, traceId, "actor-resolve", actor.canonicalIdentity ? "resolved" : "missing");
        if (actor.canonicalIdentity) {
          await requests.create({
            ...resource,
            resourceKind: "group",
            title: `Сообщество ${ctx.conversationId}`,
            initiatorCanonicalIdentity: actor.canonicalIdentity,
            ...(actor.globalId ? { initiatorGlobalId: actor.globalId } : {}),
          });
          trace(api, traceId, "pending-create", "created");
          trace(api, traceId, "dispatch-handle", "true");
          await recordDispatchOutcome("pending-created");
          return { handled: true, text: ONBOARDING_NOTICE };
        }
      }
    } catch (error) {
      dispatchOutcome = "error";
      api.logger?.warn(
        `SG workspace automatic onboarding failed safely: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    trace(api, traceId, "dispatch-handle", "false");
    await recordDispatchOutcome(dispatchOutcome);
    return { handled: false };
  });
  api.registerCommand({
    name: "sg_context",
    description: "Показать безопасный диагностический контекст SG",
    requireAuth: false,
    handler: async (ctx) => ({
      text: formatWorkspaceContext(
        await resolveWorkspaceContext({
          channel: ctx.channel,
          accountId: ctx.accountId,
          to: ctx.to,
          threadParentId: ctx.threadParentId,
          messageThreadId: ctx.messageThreadId,
          senderId: ctx.senderId,
          identityLinks: ctx.config.session?.identityLinks,
        }),
      ),
    }),
  });
  api.registerCommand({
    name: "sg_workspace",
    description: "Показать зарегистрированный workspace SG",
    requireAuth: false,
    handler: async (ctx) => {
      const resourceId = ctx.threadParentId ?? ctx.to;
      if (!resourceId) {
        return { text: formatWorkspaceResolution(undefined) };
      }
      const workspace = await registry.resolve({
        platform: ctx.channel,
        accountId: ctx.accountId,
        resourceId,
        ...(ctx.messageThreadId !== undefined ? { topicId: String(ctx.messageThreadId) } : {}),
      });
      return { text: formatWorkspaceResolution(workspace) };
    },
  });
  api.registerCommand({
    name: "sg_wsp3_diag",
    description: "Проверить полную цепочку WSP3",
    requireAuth: false,
    handler: async (ctx) => {
      const actor = await resolveWorkspaceContext(
        {
          channel: ctx.channel,
          accountId: ctx.accountId,
          to: ctx.to,
          senderId: ctx.senderId,
          identityLinks: ctx.config.session?.identityLinks,
        },
        stateDir,
      );
      if (actor.projectRole !== "monarch") {
        return { text: "WSP3 DIAG — доступ разрешён только монарху" };
      }
      let pending: Awaited<ReturnType<SgWorkspaceRequestRegistry["listPending"]>> = [];
      let storeError: string | undefined;
      try {
        pending = await requests.listPending();
      } catch (error) {
        storeError = error instanceof Error ? error.message : String(error);
      }
      const commandRouteKey = normalizedRouteKey(ctx);
      await recordDurableDiagnostic({
        stage: "diagnostic-command",
        sessionKey: ctx.sessionKey,
        routeKey: commandRouteKey,
        result: "started",
      });
      const durableSnapshot = await readDurableDiagnostics();
      const durableWindowStart = Date.now() - 10 * 60 * 1000;
      const recentDurableEvents = durableSnapshot.filter(
        (event) => Date.parse(event.recordedAt) >= durableWindowStart,
      );
      const durableHookEvents = recentDurableEvents.filter(
        (event) => event.stage !== "plugin-loaded" && event.stage !== "diagnostic-command",
      );
      const durableHookCounts = {
        beforeDispatch: durableHookEvents.filter((event) => event.stage === "before-dispatch")
          .length,
        prompt: durableHookEvents.filter((event) => event.stage === "prompt-hook").length,
        llmInput: durableHookEvents.filter((event) => event.stage === "llm-input").length,
        model: durableHookEvents.filter((event) => event.stage === "model-call").length,
        toolSelected: durableHookEvents.filter((event) => event.stage === "pending-tool-selected")
          .length,
        toolResult: durableHookEvents.filter((event) => event.stage === "pending-tool-result")
          .length,
        reply: durableHookEvents.filter((event) => event.stage === "final-reply").length,
      };
      const durableInstances = new Set(recentDurableEvents.map((event) => event.instanceId));
      const durablePids = new Set(recentDurableEvents.map((event) => event.pid));
      const currentInstanceHookCount = durableHookEvents.filter(
        (event) => event.instanceId === diagnosticInstanceId,
      ).length;
      const otherInstanceHookCount = durableHookEvents.length - currentInstanceHookCount;
      const durableHookLocation =
        currentInstanceHookCount > 0 && otherInstanceHookCount > 0
          ? "mixed"
          : otherInstanceHookCount > 0
            ? "other-instance"
            : currentInstanceHookCount > 0
              ? "current-instance"
              : "none";
      const commandRouteHash = traceIdFor(commandRouteKey);
      const commandConversationId = ctx.threadParentId ?? ctx.from ?? ctx.to;
      const commandConversationHash = traceIdFor(commandConversationId);
      const matchesCommandContext = (event: DurableDiagnosticEvent) =>
        event.conversationHash === commandConversationHash || event.routeHash === commandRouteHash;
      const latestDispatchInput = recentDurableEvents
        .toReversed()
        .find((event) => event.stage === "before-dispatch-input" && matchesCommandContext(event));
      const latestDispatchEvent = recentDurableEvents
        .toReversed()
        .find(
          (event) =>
            event.stage === "before-dispatch" &&
            (latestDispatchInput?.messageHash
              ? event.messageHash === latestDispatchInput.messageHash
              : matchesCommandContext(event)),
        );
      const latestInboundEvent = recentDurableEvents
        .toReversed()
        .find(
          (event) =>
            event.stage === "inbound-claim" &&
            (latestDispatchInput?.messageHash
              ? event.messageHash === latestDispatchInput.messageHash
              : matchesCommandContext(event)),
        );
      const dispatchRecordedAt = latestDispatchEvent
        ? Date.parse(latestDispatchEvent.recordedAt)
        : durableWindowStart;
      const latestOutboundEvent = recentDurableEvents
        .toReversed()
        .find(
          (event) =>
            event.stage === "message-sent" &&
            Date.parse(event.recordedAt) >= dispatchRecordedAt &&
            (event.conversationHash === commandConversationHash ||
              event.result === "pending-notice" ||
              event.result === "onboarding-notice" ||
              event.result === "new-session-ack" ||
              event.result === "delivery-failed"),
        );
      let targetWorkspaceStatus = "unknown";
      let targetRequestStatus = "unknown";
      let targetStoreError: string | undefined;
      if (commandConversationId) {
        try {
          const targetResource = {
            platform: ctx.channel,
            accountId: ctx.accountId,
            resourceId: canonicalResourceId(ctx.channel, commandConversationId),
          };
          targetWorkspaceStatus = (await registry.resolve(targetResource))?.status ?? "missing";
          targetRequestStatus = (await requests.resolve(targetResource))?.status ?? "missing";
        } catch (error) {
          targetStoreError = error instanceof Error ? error.message : String(error);
        }
      }
      const durableRuns = new Map<string, DurableDiagnosticEvent[]>();
      for (const event of durableHookEvents) {
        if (event.routeHash !== commandRouteHash) {
          continue;
        }
        const key = event.runHash;
        const runEvents = durableRuns.get(key) ?? [];
        runEvents.push(event);
        durableRuns.set(key, runEvents);
      }
      const latestDurableRunEvents = [...durableRuns.values()]
        .filter((events) =>
          events.some((event) => event.stage === "model-call" || event.stage === "final-reply"),
        )
        .toSorted((left, right) => {
          const leftTime = Math.max(...left.map((event) => Date.parse(event.recordedAt)));
          const rightTime = Math.max(...right.map((event) => Date.parse(event.recordedAt)));
          return rightTime - leftTime;
        })[0];
      const durableLlmInput = latestDurableRunEvents
        ? latestDurableRunEvents.toReversed().find((event) => event.stage === "llm-input")
        : undefined;
      const durableToolResult = latestDurableRunEvents
        ? latestDurableRunEvents.toReversed().find((event) => event.stage === "pending-tool-result")
        : undefined;
      const durableToolPayload = durableToolResult?.result.match(/^([^:]+):(\d+)$/);
      const durableTrace: Wsp3DiagnosticTrace | undefined = latestDurableRunEvents
        ? {
            sequence: 0,
            promptHook: latestDurableRunEvents.some((event) => event.stage === "prompt-hook"),
            pendingToolAllowed:
              durableLlmInput?.result === "pending-tool-present"
                ? true
                : durableLlmInput?.result === "pending-tool-missing"
                  ? false
                  : undefined,
            modelCalls: latestDurableRunEvents.filter((event) => event.stage === "model-call")
              .length,
            pendingToolSelected: latestDurableRunEvents.some(
              (event) => event.stage === "pending-tool-selected",
            ),
            pendingToolCompleted:
              Boolean(durableToolResult) && durableToolResult?.result !== "execution-error",
            pendingToolResultReadable: Boolean(durableToolPayload),
            pendingToolResultStatus: durableToolPayload?.[1],
            pendingToolResultCount: durableToolPayload
              ? Number.parseInt(durableToolPayload[2] ?? "", 10)
              : undefined,
            toolError:
              durableToolResult?.result === "execution-error" ? "execution-error" : undefined,
            finalReply: latestDurableRunEvents.some(
              (event) => event.stage === "final-reply" && event.result === "present",
            ),
          }
        : undefined;
      const sessionTrace = ctx.sessionKey
        ? diagnosticTraces.toReversed().find((candidate) => candidate.sessionKey === ctx.sessionKey)
        : undefined;
      const routeTrace = commandRouteKey
        ? diagnosticTraces.toReversed().find((candidate) => candidate.routeKey === commandRouteKey)
        : undefined;
      const lastTrace = sessionTrace ?? routeTrace;
      const durableRunMatches =
        !lastTrace?.runId || latestDurableRunEvents?.[0]?.runHash === traceIdFor(lastTrace.runId);
      const useDurableTrace =
        durableTrace !== undefined &&
        durableRunMatches &&
        (!lastTrace ||
          durableTrace.modelCalls > lastTrace.modelCalls ||
          (durableTrace.pendingToolSelected && !lastTrace.pendingToolSelected) ||
          (durableTrace.pendingToolCompleted && !lastTrace.pendingToolCompleted) ||
          (durableTrace.finalReply && !lastTrace.finalReply));
      const effectiveTrace = useDurableTrace ? durableTrace : (lastTrace ?? durableTrace);
      const traceMatch = useDurableTrace
        ? "durable-route"
        : sessionTrace
          ? "session"
          : routeTrace
            ? "route"
            : "none";
      const latestObservedTrace = diagnosticTraces.at(-1);
      const pendingTitles = pending
        .map((request) => request.title.replace(/\s+/g, " ").trim())
        .slice(0, 5);
      let failure = diagnosticFailure({
        trace: effectiveTrace,
        projectRole: actor.projectRole,
        pendingCount: pending.length,
        storeError,
      });
      const observedHookCount = Object.values(hookCounts).reduce((sum, count) => sum + count, 0);
      if (!effectiveTrace && observedHookCount === 0) {
        failure =
          otherInstanceHookCount > 0
            ? "lifecycle_hooks_observed_other_instance"
            : currentInstanceHookCount > 0
              ? "lifecycle_memory_trace_lost"
              : "lifecycle_hooks_not_observed";
      } else if (!effectiveTrace && latestObservedTrace) {
        failure = "trace_identity_mismatch";
      }
      if (
        latestDispatchEvent?.result === "system-command-bypassed" ||
        latestDispatchEvent?.result === "workspace-active"
      ) {
        failure = "none";
      } else if (latestDispatchEvent?.result.startsWith("pending-")) {
        failure = `before_dispatch_${latestDispatchEvent.result.replaceAll("-", "_")}`;
      }
      let breakpoint = "none";
      if (!latestDispatchInput) {
        breakpoint = "before_dispatch_input_not_observed";
      } else if (!latestDispatchEvent) {
        breakpoint = "before_dispatch_outcome_not_observed";
      } else if (latestDispatchEvent.result.startsWith("pending-")) {
        const inputFacts = latestDispatchInput.facts;
        const recognizedSystemCommand =
          inputFacts?.slashLane === true || inputFacts?.slashText === true;
        breakpoint = recognizedSystemCommand
          ? "system_command_bypass_not_applied"
          : "system_command_signal_lost_before_dispatch";
      } else if (
        latestDispatchEvent.result === "system-command-bypassed" &&
        latestOutboundEvent?.result === "pending-notice"
      ) {
        breakpoint = "stale_or_cross_instance_delivery";
      } else if (latestOutboundEvent?.result === "delivery-failed") {
        breakpoint = "outbound_delivery_failed";
      }
      diagnosticLog(ctx.sessionKey, lastTrace?.runId, "summary", failure);
      const traceStatus = (value: boolean | undefined) =>
        value === undefined ? "UNKNOWN" : value ? "OK" : "FAIL";
      return {
        text: [
          "WSP3 DIAG",
          `diagnostic_version: ${WSP3_DIAGNOSTIC_VERSION}`,
          `image_commit: ${process.env.SG22_IMAGE_COMMIT?.trim() || "unknown"}`,
          `core_commit: ${process.env.GIT_COMMIT?.trim() || "unknown"}`,
          "plugin_loader: OK",
          `identity: ${actor.projectRole ? `OK (${actor.projectRole})` : "FAIL (unresolved)"}`,
          `trace_match: ${traceMatch}`,
          `command_session: ${traceIdFor(ctx.sessionKey)}`,
          `command_route: ${traceIdFor(commandRouteKey)}`,
          `last_trace: ${
            useDurableTrace && latestDurableRunEvents
              ? `PRESENT (durable session=${latestDurableRunEvents[0]?.sessionHash}, route=${latestDurableRunEvents[0]?.routeHash}, run=${latestDurableRunEvents[0]?.runHash})`
              : lastTrace
                ? `PRESENT (session=${traceIdFor(lastTrace.sessionKey)}, route=${traceIdFor(lastTrace.routeKey)}, run=${traceIdFor(lastTrace.runId)})`
                : "NONE"
          }`,
          `hook_counts: prompt=${hookCounts.prompt}, llm_input=${hookCounts.llmInput}, model=${hookCounts.model}, tool_selected=${hookCounts.toolSelected}, tool_result=${hookCounts.toolResult}, reply=${hookCounts.reply}`,
          `durable_trace: ${recentDurableEvents.length > 0 ? "OK" : "FAIL"}`,
          `durable_instances: ${durableInstances.size}, pids=${durablePids.size}`,
          `durable_hook_location: ${durableHookLocation}`,
          `durable_hook_counts: before_dispatch=${durableHookCounts.beforeDispatch}, prompt=${durableHookCounts.prompt}, llm_input=${durableHookCounts.llmInput}, model=${durableHookCounts.model}, tool_selected=${durableHookCounts.toolSelected}, tool_result=${durableHookCounts.toolResult}, reply=${durableHookCounts.reply}`,
          `e2e_target: conversation=${commandConversationHash}, route=${commandRouteHash}`,
          `ingress: ${latestInboundEvent ? `OK (${formatDiagnosticFacts(latestInboundEvent)})` : "UNKNOWN"}`,
          `dispatch_input: ${latestDispatchInput ? `OK (${formatDiagnosticFacts(latestDispatchInput)})` : "UNKNOWN"}`,
          `before_dispatch: ${latestDispatchEvent ? `OK (${latestDispatchEvent.result})` : "UNKNOWN"}`,
          `decision_instance: ${latestDispatchEvent ? `${latestDispatchEvent.instanceId === diagnosticInstanceId ? "current" : "other"},pid=${latestDispatchEvent.pid},diag=${latestDispatchEvent.diagnosticVersion ?? "legacy"},image=${latestDispatchEvent.imageCommit ?? "unknown"}` : "UNKNOWN"}`,
          `target_workspace: ${targetStoreError ? `FAIL (${targetStoreError})` : targetWorkspaceStatus}`,
          `target_request: ${targetStoreError ? `FAIL (${targetStoreError})` : targetRequestStatus}`,
          `outbound: ${latestOutboundEvent ? `${latestOutboundEvent.result} (${formatDiagnosticFacts(latestOutboundEvent)})` : "UNKNOWN"}`,
          `prompt_hook: ${traceStatus(effectiveTrace?.promptHook)}`,
          `pending_tool_surface: ${traceStatus(effectiveTrace?.pendingToolAllowed)}`,
          `model_call: ${effectiveTrace ? `OK (${effectiveTrace.modelCalls})` : "UNKNOWN"}`,
          `pending_tool_selected: ${traceStatus(effectiveTrace?.pendingToolSelected)}`,
          `pending_store: ${storeError ? `FAIL (${storeError})` : `OK (${pending.length}: ${pendingTitles.join(", ") || "empty"})`}`,
          `pending_tool_result: ${traceStatus(effectiveTrace?.pendingToolCompleted)}`,
          `pending_tool_payload: ${
            !effectiveTrace?.pendingToolCompleted
              ? "UNKNOWN"
              : effectiveTrace.pendingToolResultReadable !== true
                ? "FAIL (invalid)"
                : `${effectiveTrace.pendingToolResultStatus === "ok" ? "OK" : "FAIL"} (${effectiveTrace.pendingToolResultStatus}: ${effectiveTrace.pendingToolResultCount ?? "n/a"})`
          }`,
          `reply_path: ${traceStatus(effectiveTrace?.finalReply)}`,
          `breakpoint: ${breakpoint}`,
          `failure: ${failure}`,
        ].join("\n"),
      };
    },
  });
  api.registerCommand({
    name: "sg_wsp5_diag",
    description: "Проверить полную цепочку WSP5",
    requireAuth: false,
    handler: async (ctx) => {
      const actor = await resolveWorkspaceContext(
        {
          channel: ctx.channel,
          accountId: ctx.accountId,
          to: ctx.to,
          threadParentId: ctx.threadParentId,
          messageThreadId: ctx.messageThreadId,
          senderId: ctx.senderId,
          identityLinks: ctx.config.session?.identityLinks,
        },
        stateDir,
      );
      if (actor.projectRole !== "monarch" || !actor.globalId) {
        return { text: "WSP5 DIAG — доступ разрешён только монарху" };
      }
      return {
        text: await buildWsp5Diagnostic({
          stateDir,
          actor,
          registeredToolNames: WSP5_TOOL_NAMES,
          lifecycle: wsp5Lifecycle.snapshot(),
        }),
      };
    },
  });
  api.registerCommand({
    name: "sg_wsp6_diag",
    description: "Проверить цепочку опросов и тестов WSP6",
    requireAuth: false,
    handler: async (ctx) => {
      const actor = await resolveWorkspaceContext(
        {
          channel: ctx.channel,
          accountId: ctx.accountId,
          to: ctx.to,
          threadParentId: ctx.threadParentId,
          messageThreadId: ctx.messageThreadId,
          senderId: ctx.senderId,
          identityLinks: ctx.config.session?.identityLinks,
        },
        stateDir,
      );
      if (actor.projectRole !== "monarch" || !actor.globalId) {
        return { text: "WSP6 DIAG — доступ разрешён только монарху" };
      }
      return {
        text: await buildWsp6Diagnostic({
          assessments: resolveAssessments(),
          lifecycle: wsp6Lifecycle.snapshot(),
          interactive: wsp6Interactive?.snapshot(),
          registeredToolNames: WSP6_TOOL_NAMES,
        }),
      };
    },
  });
  api.registerCommand({
    name: "sg_context_diag",
    description: "Проверить полную цепочку контекста и compaction SG",
    acceptsArgs: true,
    requireAuth: false,
    handler: async (ctx) => {
      const actor = await resolveWorkspaceContext(
        {
          channel: ctx.channel,
          accountId: ctx.accountId,
          to: ctx.to,
          senderId: ctx.senderId,
          identityLinks: ctx.config.session?.identityLinks,
        },
        stateDir,
      );
      if (actor.projectRole !== "monarch" || !actor.globalId) {
        return { text: "SG CONTEXT DIAG — доступ разрешён только монарху" };
      }
      return { text: await contextDiagnostics.report(ctx) };
    },
  });
  api.registerCommand({
    name: "sg_cost_diag",
    description: "Проверить изоляцию сессии и защиту стоимости SG",
    requireAuth: false,
    handler: async (ctx) => {
      const actor = await resolveWorkspaceContext(
        {
          channel: ctx.channel,
          accountId: ctx.accountId,
          to: ctx.to,
          senderId: ctx.senderId,
          identityLinks: ctx.config.session?.identityLinks,
        },
        stateDir,
      );
      if (actor.projectRole !== "monarch" || !actor.globalId) {
        return { text: "SG COST DIAG — доступ разрешён только монарху" };
      }
      return {
        text: buildSgCostDiagnostic({
          config: ctx.config,
          channel: ctx.channel,
          sessionKey: ctx.sessionKey,
        }),
      };
    },
  });
}
