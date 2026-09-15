import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type {
  MemorySearchManager,
  MemorySearchResult,
} from "openclaw/plugin-sdk/memory-core-host-engine-storage";
import { getActiveMemorySearchManager } from "openclaw/plugin-sdk/memory-host-search";
import type { OpenClawConfig, OpenClawPluginToolContext } from "openclaw/plugin-sdk/plugin-entry";
import { jsonResult } from "openclaw/plugin-sdk/tool-results";
import {
  appendScopedMemoryEntry,
  correctScopedMemoryEntry,
  exportScopedMemory,
} from "./scoped-memory-entries.js";
import { canonicalWorkspaceResourceId, SgWorkspaceRegistry } from "./workspace-registry.js";

export const RESOURCE_MEMORY_TOOL_NAMES = [
  "sg_resource_memory_remember",
  "sg_resource_memory_search",
  "sg_resource_memory_get",
  "sg_resource_memory_correct",
  "sg_resource_memory_export",
  "sg_resource_memory_reindex",
] as const;

export const RESOURCE_MEMORY_AGENT_GUIDANCE = [
  "SG — долговременная память текущего ресурса",
  "Используй sg_resource_memory_search для знаний, общих только для текущей группы или workspace.",
  "Используй sg_resource_memory_remember, когда нужно явно сохранить общий факт текущего ресурса.",
  "Используй sg_resource_memory_correct только для выбранной записи текущего ресурса по entryId.",
  "Используй sg_resource_memory_export и sg_resource_memory_reindex только для текущего ресурса.",
  "Используй sg_resource_memory_get только для чтения найденного файла resource memory.",
  "Не сохраняй сюда личные данные участников, секреты или проектные полномочия монарха.",
].join("\n");

export type ResourceMemoryManagerLoader = (params: {
  cfg: OpenClawConfig;
  agentId: string;
}) => Promise<{ manager: MemorySearchManager | null; error?: string }>;

type ResourceMemoryToolContext = Pick<
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

type ResourceActor = {
  resourceScopeId: string;
  workspaceRoot: string;
};

const MEMORY_FILE = "MEMORY.md";
const RESOURCE_MEMORY_ROOT = "memory/resources";

function stringParam(params: Record<string, unknown>, key: string, maxLength: number): string {
  const value = params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`sg-resource-memory-${key}-required`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`sg-resource-memory-${key}-too-long`);
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
    throw new Error(`sg-resource-memory-${key}-invalid`);
  }
  return value;
}

function nonNegativeIntegerParam(
  params: Record<string, unknown>,
  key: string,
  fallback: number,
  max: number,
): number {
  const value = params[key];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > max) {
    throw new Error(`sg-resource-memory-${key}-invalid`);
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

function runtimeConfig(ctx: ResourceMemoryToolContext): OpenClawConfig {
  return ctx.getRuntimeConfig?.() ?? ctx.runtimeConfig ?? ctx.config ?? {};
}

function resourceAgentId(resourceScopeId: string): string {
  return `sg-resource-memory-${createHash("sha256")
    .update(resourceScopeId)
    .digest("hex")
    .slice(0, 24)}`;
}

function scopedConfig(
  config: OpenClawConfig,
  actor: ResourceActor,
): { cfg: OpenClawConfig; agentId: string } {
  const agentId = resourceAgentId(actor.resourceScopeId);
  return {
    agentId,
    cfg: {
      ...config,
      agents: {
        ...config.agents,
        ownership: "explicit",
        entries: {
          ...config.agents?.entries,
          [agentId]: { workspace: actor.workspaceRoot },
        },
      },
    },
  };
}

async function resolveActor(
  ctx: ResourceMemoryToolContext,
  stateDir: string,
): Promise<ResourceActor> {
  const channel = ctx.messageChannel?.trim();
  const conversationId = ctx.nativeChannelId?.trim();
  const senderId = ctx.requesterSenderId?.trim();
  const workspaceDir = ctx.workspaceDir?.trim();
  if (!channel || !conversationId || !senderId || !workspaceDir) {
    throw new Error("sg-resource-memory-trusted-context-required");
  }
  const scope = await new SgWorkspaceRegistry(stateDir).resolve({
    platform: channel,
    accountId: ctx.agentAccountId,
    resourceId: canonicalWorkspaceResourceId(channel, conversationId),
  });
  if (!scope) {
    throw new Error("sg-resource-memory-scope-required");
  }
  const workspaceRoot = path.resolve(workspaceDir, RESOURCE_MEMORY_ROOT, scope.resourceScopeId);
  if (!inside(path.resolve(workspaceDir), workspaceRoot)) {
    throw new Error("sg-resource-memory-root-invalid");
  }
  return { resourceScopeId: scope.resourceScopeId, workspaceRoot };
}

async function managerFor(
  ctx: ResourceMemoryToolContext,
  actor: ResourceActor,
  loadManager: ResourceMemoryManagerLoader,
): Promise<MemorySearchManager> {
  const loaded = await loadManager(scopedConfig(runtimeConfig(ctx), actor));
  if (!loaded.manager) {
    throw new Error(`sg-resource-memory-manager-unavailable: ${loaded.error ?? "unknown"}`);
  }
  return loaded.manager;
}

function managerWorkspace(manager: MemorySearchManager, fallback: string): string {
  const configured = manager.status().workspaceDir?.trim();
  return path.resolve(configured || fallback);
}

function isolatedHits(
  manager: MemorySearchManager,
  actor: ResourceActor,
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

function safeResourceFile(actor: ResourceActor, requestedPath: string): string {
  if (path.isAbsolute(requestedPath)) {
    throw new Error("sg-resource-memory-path-invalid");
  }
  const target = path.resolve(actor.workspaceRoot, requestedPath);
  if (!inside(actor.workspaceRoot, target) || path.extname(target).toLowerCase() !== ".md") {
    throw new Error("sg-resource-memory-path-invalid");
  }
  return target;
}

function memoryFile(actor: ResourceActor): string {
  return path.join(actor.workspaceRoot, MEMORY_FILE);
}

export function createResourceMemoryTools(
  ctx: ResourceMemoryToolContext,
  stateDir: string,
  loadManager: ResourceMemoryManagerLoader = getActiveMemorySearchManager,
) {
  return [
    {
      name: "sg_resource_memory_remember",
      label: "SG Resource Memory Remember",
      description: "Persist one durable fact only in the current registered resource scope.",
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
        const text = stringParam(params, "text", 12000).replace(/\s*\r?\n\s*/gu, " ");
        await mkdir(actor.workspaceRoot, { recursive: true });
        const entryId = await appendScopedMemoryEntry({
          filePath: memoryFile(actor),
          idPrefix: "rmem",
          text,
        });
        const manager = await managerFor(ctx, actor, loadManager);
        await manager.sync?.({ reason: "sg-resource-memory-write", force: true });
        return jsonResult({
          saved: true,
          resourceScopeId: actor.resourceScopeId,
          path: MEMORY_FILE,
          entryId,
        });
      },
    },
    {
      name: "sg_resource_memory_correct",
      label: "SG Resource Memory Correct",
      description: "Correct one active entry only in the current registered resource scope.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          entryId: { type: "string", minLength: 1, maxLength: 200 },
          text: { type: "string", minLength: 1, maxLength: 12000 },
        },
        required: ["entryId", "text"],
      },
      execute: async (_toolCallId: string, params: Record<string, unknown>) => {
        const actor = await resolveActor(ctx, stateDir);
        const result = await correctScopedMemoryEntry({
          filePath: memoryFile(actor),
          entryId: stringParam(params, "entryId", 200),
          idPrefix: "rmem",
          text: stringParam(params, "text", 12000).replace(/\s*\r?\n\s*/gu, " "),
        });
        const manager = await managerFor(ctx, actor, loadManager);
        await manager.sync?.({ reason: "sg-resource-memory-correct", force: true });
        return jsonResult({
          status: "corrected",
          resourceScopeId: actor.resourceScopeId,
          ...result,
        });
      },
    },
    {
      name: "sg_resource_memory_export",
      label: "SG Resource Memory Export",
      description: "Export active Markdown memory only from the current registered resource.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          from: { type: "integer", minimum: 0 },
          maxChars: { type: "integer", minimum: 1, maximum: 32000 },
        },
      },
      execute: async (_toolCallId: string, params: Record<string, unknown>) => {
        const actor = await resolveActor(ctx, stateDir);
        return jsonResult({
          status: "ok",
          resourceScopeId: actor.resourceScopeId,
          path: MEMORY_FILE,
          ...(await exportScopedMemory(memoryFile(actor), {
            from: nonNegativeIntegerParam(params, "from", 0, Number.MAX_SAFE_INTEGER),
            maxChars: positiveIntegerParam(params, "maxChars", 32_000, 32_000),
          })),
        });
      },
    },
    {
      name: "sg_resource_memory_reindex",
      label: "SG Resource Memory Reindex",
      description: "Force Memory Core to rebuild only the current registered resource index.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
      execute: async () => {
        const actor = await resolveActor(ctx, stateDir);
        const manager = await managerFor(ctx, actor, loadManager);
        await manager.sync?.({ reason: "sg-resource-memory-reindex", force: true });
        return jsonResult({ status: "ok", resourceScopeId: actor.resourceScopeId });
      },
    },
    {
      name: "sg_resource_memory_search",
      label: "SG Resource Memory Search",
      description: "Search only the current registered resource's durable memory with Memory Core.",
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
        const query = stringParam(params, "query", 1000);
        const maxResults = positiveIntegerParam(params, "maxResults", 6, 20);
        const manager = await managerFor(ctx, actor, loadManager);
        await manager.sync?.({ reason: "sg-resource-memory-search" });
        const hits = await manager.search(query, {
          maxResults,
          sessionKey: ctx.sessionKey,
          sources: ["memory"],
        });
        return jsonResult({
          resourceScopeId: actor.resourceScopeId,
          results: isolatedHits(manager, actor, hits, maxResults),
        });
      },
    },
    {
      name: "sg_resource_memory_get",
      label: "SG Resource Memory Get",
      description: "Read one Markdown file only from the current registered resource memory.",
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
        const requestedPath = stringParam(params, "path", 500);
        const target = safeResourceFile(actor, requestedPath);
        const manager = await managerFor(ctx, actor, loadManager);
        const managerRoot = managerWorkspace(manager, actor.workspaceRoot);
        const result = await manager.readFile({
          relPath: portable(path.relative(managerRoot, target)),
          ...(params.from === undefined
            ? {}
            : {
                from: positiveIntegerParam(params, "from", 1, Number.MAX_SAFE_INTEGER),
              }),
          ...(params.lines === undefined
            ? {}
            : { lines: positiveIntegerParam(params, "lines", 1, 1000) }),
        });
        return jsonResult({
          resourceScopeId: actor.resourceScopeId,
          ...result,
          path: portable(path.relative(actor.workspaceRoot, target)),
        });
      },
    },
  ];
}
