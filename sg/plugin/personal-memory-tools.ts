import { createHash } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getActiveMemorySearchManager } from "openclaw/plugin-sdk/memory-host-search";
import type {
  MemorySearchManager,
  MemorySearchResult,
} from "openclaw/plugin-sdk/memory-core-host-engine-storage";
import type {
  OpenClawConfig,
  OpenClawPluginToolContext,
} from "openclaw/plugin-sdk/plugin-entry";
import { jsonResult } from "openclaw/plugin-sdk/tool-results";
import { resolveWorkspaceContext } from "./context.js";

export const PERSONAL_MEMORY_AGENT_GUIDANCE = [
  "SG — личная долговременная память",
  "Используй sg_memory_search для поиска устойчивых фактов и незавершённых задач пользователя.",
  "Используй sg_memory_remember, когда пользователь явно просит запомнить факт или предпочтение.",
  "Используй sg_memory_get только для чтения найденного файла личной памяти.",
  "Не используй штатные memory_search и memory_get: личная память SG изолируется по Global ID.",
].join("\n");

export type PersonalMemoryManagerLoader = (params: {
  cfg: OpenClawConfig;
  agentId: string;
}) => Promise<{ manager: MemorySearchManager | null; error?: string }>;

type PersonalMemoryToolContext = Pick<
  OpenClawPluginToolContext,
  | "config"
  | "runtimeConfig"
  | "getRuntimeConfig"
  | "messageChannel"
  | "agentAccountId"
  | "nativeChannelId"
  | "requesterSenderId"
  | "workspaceDir"
  | "sessionKey"
>;

type PersonalActor = {
  globalId: string;
  workspaceRoot: string;
};

const MEMORY_FILE = "MEMORY.md";

function stringParam(
  params: Record<string, unknown>,
  key: string,
  options: { maxLength: number },
): string {
  const value = params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`sg-personal-memory-${key}-required`);
  }
  const normalized = value.trim();
  if (normalized.length > options.maxLength) {
    throw new Error(`sg-personal-memory-${key}-too-long`);
  }
  return normalized;
}

function positiveIntegerParam(
  params: Record<string, unknown>,
  key: string,
  fallback: number,
  max: number,
): number {
  const value = params[key];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`sg-personal-memory-${key}-invalid`);
  }
  return value;
}

function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

function portable(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function personalAgentId(globalId: string): string {
  return `sg-memory-${createHash("sha256").update(globalId).digest("hex").slice(0, 24)}`;
}

function scopedConfig(
  config: OpenClawConfig,
  actor: PersonalActor,
): { cfg: OpenClawConfig; agentId: string } {
  const agentId = personalAgentId(actor.globalId);
  return {
    agentId,
    cfg: {
      ...config,
      agents: {
        ...config.agents,
        ownership: "explicit",
        entries: {
          ...(config.agents?.entries ?? {}),
          [agentId]: { workspace: actor.workspaceRoot },
        },
      },
    },
  };
}

async function resolveActor(
  ctx: PersonalMemoryToolContext,
  stateDir: string,
): Promise<PersonalActor> {
  const senderId = ctx.requesterSenderId?.trim();
  const channel = ctx.messageChannel?.trim();
  if (!senderId || !channel) {
    throw new Error("sg-personal-memory-trusted-sender-identity-required");
  }
  const actor = await resolveWorkspaceContext(
    {
      channel,
      accountId: ctx.agentAccountId,
      to: ctx.nativeChannelId,
      senderId,
      identityLinks:
        (ctx.getRuntimeConfig?.() ?? ctx.runtimeConfig ?? ctx.config)?.session?.identityLinks,
    },
    stateDir,
  );
  if (!actor.globalId || !actor.personalWorkspaceRoot) {
    throw new Error("sg-personal-memory-citizen-identity-required");
  }
  return { globalId: actor.globalId, workspaceRoot: actor.personalWorkspaceRoot };
}

async function managerFor(
  ctx: PersonalMemoryToolContext,
  actor: PersonalActor,
  loadManager: PersonalMemoryManagerLoader,
): Promise<MemorySearchManager> {
  const config = ctx.getRuntimeConfig?.() ?? ctx.runtimeConfig ?? ctx.config ?? {};
  const scoped = scopedConfig(config, actor);
  const loaded = await loadManager(scoped);
  if (!loaded.manager) {
    throw new Error(`sg-personal-memory-manager-unavailable: ${loaded.error ?? "unknown"}`);
  }
  return loaded.manager;
}

function managerWorkspace(manager: MemorySearchManager, fallback: string): string {
  const configured = manager.status().workspaceDir?.trim();
  return path.resolve(configured || fallback);
}

function isolatedHits(
  manager: MemorySearchManager,
  actor: PersonalActor,
  hits: MemorySearchResult[],
  limit: number,
) {
  const managerRoot = managerWorkspace(manager, actor.workspaceRoot);
  return hits
    .flatMap((hit) => {
      const absolutePath = path.resolve(managerRoot, hit.path);
      if (!inside(actor.workspaceRoot, absolutePath)) {
        return [];
      }
      return [
        {
          path: portable(path.relative(actor.workspaceRoot, absolutePath)),
          startLine: hit.startLine,
          endLine: hit.endLine,
          score: hit.score,
          snippet: hit.snippet,
          source: hit.source,
        },
      ];
    })
    .slice(0, limit);
}

function safePersonalFile(actor: PersonalActor, requestedPath: string): string {
  if (path.isAbsolute(requestedPath)) {
    throw new Error("sg-personal-memory-path-invalid");
  }
  const target = path.resolve(actor.workspaceRoot, requestedPath);
  if (!inside(actor.workspaceRoot, target) || path.extname(target).toLowerCase() !== ".md") {
    throw new Error("sg-personal-memory-path-invalid");
  }
  return target;
}

export function createPersonalMemoryTools(
  ctx: PersonalMemoryToolContext,
  stateDir: string,
  loadManager: PersonalMemoryManagerLoader = getActiveMemorySearchManager,
) {
  return [
    {
      name: "sg_memory_remember",
      label: "SG Personal Memory Remember",
      description: "Persist one durable fact in the current citizen's Global-ID workspace.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string", minLength: 1, maxLength: 12000 },
        },
        required: ["text"],
      },
      execute: async (_toolCallId: string, params: Record<string, unknown>) => {
        const actor = await resolveActor(ctx, stateDir);
        const text = stringParam(params, "text", { maxLength: 12000 }).replace(/\s*\r?\n\s*/gu, " ");
        await mkdir(actor.workspaceRoot, { recursive: true });
        await appendFile(path.join(actor.workspaceRoot, MEMORY_FILE), `- ${text}\n`, {
          encoding: "utf8",
          flag: "a",
        });
        const manager = await managerFor(ctx, actor, loadManager);
        await manager.sync?.({ reason: "sg-personal-memory-write", force: true });
        return jsonResult({ saved: true, globalId: actor.globalId, path: MEMORY_FILE });
      },
    },
    {
      name: "sg_memory_search",
      label: "SG Personal Memory Search",
      description: "Search only the current citizen's durable Global-ID memory with Memory Core.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string", minLength: 1, maxLength: 1000 },
          maxResults: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["query"],
      },
      execute: async (_toolCallId: string, params: Record<string, unknown>) => {
        const actor = await resolveActor(ctx, stateDir);
        const query = stringParam(params, "query", { maxLength: 1000 });
        const maxResults = positiveIntegerParam(params, "maxResults", 6, 20);
        const manager = await managerFor(ctx, actor, loadManager);
        await manager.sync?.({ reason: "sg-personal-memory-search" });
        const hits = await manager.search(query, {
          maxResults,
          sessionKey: ctx.sessionKey,
          sources: ["memory"],
        });
        return jsonResult({
          globalId: actor.globalId,
          results: isolatedHits(manager, actor, hits, maxResults),
        });
      },
    },
    {
      name: "sg_memory_get",
      label: "SG Personal Memory Get",
      description: "Read one Markdown file only from the current citizen's Global-ID workspace.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string", minLength: 1, maxLength: 500 },
          from: { type: "integer", minimum: 1 },
          lines: { type: "integer", minimum: 1, maximum: 1000 },
        },
        required: ["path"],
      },
      execute: async (_toolCallId: string, params: Record<string, unknown>) => {
        const actor = await resolveActor(ctx, stateDir);
        const requestedPath = stringParam(params, "path", { maxLength: 500 });
        const target = safePersonalFile(actor, requestedPath);
        const manager = await managerFor(ctx, actor, loadManager);
        const managerRoot = managerWorkspace(manager, actor.workspaceRoot);
        const result = await manager.readFile({
          relPath: portable(path.relative(managerRoot, target)),
          ...(params.from === undefined
            ? {}
            : { from: positiveIntegerParam(params, "from", 1, Number.MAX_SAFE_INTEGER) }),
          ...(params.lines === undefined
            ? {}
            : { lines: positiveIntegerParam(params, "lines", 1, 1000) }),
        });
        return jsonResult({
          globalId: actor.globalId,
          ...result,
          path: portable(path.relative(actor.workspaceRoot, target)),
        });
      },
    },
  ];
}
