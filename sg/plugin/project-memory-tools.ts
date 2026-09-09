import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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

export const PROJECT_MEMORY_TOOL_NAMES = [
  "sg_project_memory_record",
  "sg_project_memory_search",
  "sg_project_memory_get",
] as const;

export const PROJECT_MEMORY_AGENT_GUIDANCE = [
  "SG — проектная память монарха",
  "Используй sg_project_memory_search для поиска решений, инцидентов и проектных задач.",
  "Используй sg_project_memory_get для чтения найденной записи.",
  "Используй sg_project_memory_record для новой записи или новой версии через supersedesId.",
  "Не изменяй старую запись: supersession сохраняет историю.",
  "OpenClaw Memory Core остаётся единственным индексом и поисковым движком.",
].join("\n");

export type ProjectMemoryManagerLoader = (params: {
  cfg: OpenClawConfig;
  agentId: string;
}) => Promise<{ manager: MemorySearchManager | null; error?: string }>;

type ProjectMemoryToolContext = Pick<
  OpenClawPluginToolContext,
  | "config"
  | "runtimeConfig"
  | "getRuntimeConfig"
  | "messageChannel"
  | "agentAccountId"
  | "nativeChannelId"
  | "requesterSenderId"
  | "workspaceDir"
  | "agentId"
  | "sessionKey"
  | "activeProjectKeys"
>;

type ProjectRecordType = "decision" | "incident" | "task";

type ProjectRecordMetadata = {
  schemaVersion: 1;
  id: string;
  lineageId: string;
  recordType: ProjectRecordType;
  title: string;
  status: string;
  actorGlobalId: string;
  recordedAt: string;
  channel: string;
  senderId: string;
  projectKeys: string[];
  sourceRefs: string[];
  supersedesId?: string;
  runtimeTaskId?: string;
  runtimeFlowId?: string;
};

type StoredProjectRecord = {
  metadata: ProjectRecordMetadata;
  absolutePath: string;
  relativePath: string;
  content: string;
};

type ProjectActor = {
  globalId: string;
  channel: string;
  senderId: string;
  workspaceRoot: string;
};

const PROJECT_ROOT = "memory/projects/sg";
const PROJECT_KEY = "project-sg";
const METADATA_PREFIX = "<!-- sg-project-memory:";
const TYPE_DIRECTORIES: Record<ProjectRecordType, string> = {
  decision: "decisions",
  incident: "incidents",
  task: "tasks",
};
const TYPE_STATUSES: Record<ProjectRecordType, readonly string[]> = {
  decision: ["active", "revoked"],
  incident: ["open", "mitigated", "resolved"],
  task: ["planned", "in_progress", "blocked", "done", "cancelled"],
};
const DEFAULT_STATUS: Record<ProjectRecordType, string> = {
  decision: "active",
  incident: "open",
  task: "planned",
};

function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

function portable(value: string): string {
  return value.split(path.sep).join("/");
}

function requiredText(
  params: Record<string, unknown>,
  key: string,
  maxLength: number,
): string {
  const value = params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`sg-project-memory-${key}-required`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`sg-project-memory-${key}-too-long`);
  }
  return normalized;
}

function optionalText(
  params: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | undefined {
  const value = params[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`sg-project-memory-${key}-invalid`);
  }
  return value.trim();
}

function optionalStringArray(
  params: Record<string, unknown>,
  key: string,
  maxItems: number,
  maxLength: number,
): string[] {
  const value = params[key];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`sg-project-memory-${key}-invalid`);
  }
  return value.map((entry) => {
    if (typeof entry !== "string" || !entry.trim() || entry.trim().length > maxLength) {
      throw new Error(`sg-project-memory-${key}-invalid`);
    }
    return entry.trim();
  });
}

function recordTypeParam(params: Record<string, unknown>): ProjectRecordType {
  const value = requiredText(params, "recordType", 32);
  if (value !== "decision" && value !== "incident" && value !== "task") {
    throw new Error("sg-project-memory-recordType-invalid");
  }
  return value;
}

function statusParam(params: Record<string, unknown>, recordType: ProjectRecordType): string {
  const status = optionalText(params, "status", 64) ?? DEFAULT_STATUS[recordType];
  if (!TYPE_STATUSES[recordType].includes(status)) {
    throw new Error("sg-project-memory-status-invalid");
  }
  return status;
}

function positiveInteger(
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
    throw new Error(`sg-project-memory-${key}-invalid`);
  }
  return value;
}

function runtimeConfig(ctx: ProjectMemoryToolContext): OpenClawConfig {
  return ctx.getRuntimeConfig?.() ?? ctx.runtimeConfig ?? ctx.config ?? {};
}

async function resolveActor(
  ctx: ProjectMemoryToolContext,
  stateDir: string,
): Promise<ProjectActor> {
  const senderId = ctx.requesterSenderId?.trim();
  const channel = ctx.messageChannel?.trim();
  const workspaceRoot = ctx.workspaceDir?.trim();
  if (!senderId || !channel || !workspaceRoot) {
    throw new Error("sg-project-memory-trusted-context-required");
  }
  const actor = await resolveWorkspaceContext(
    {
      channel,
      accountId: ctx.agentAccountId,
      to: ctx.nativeChannelId,
      senderId,
      identityLinks: runtimeConfig(ctx).session?.identityLinks,
    },
    stateDir,
  );
  if (actor.projectRole !== "monarch" || !actor.globalId) {
    throw new Error("sg-project-memory-monarch-required");
  }
  return {
    globalId: actor.globalId,
    channel,
    senderId,
    workspaceRoot: path.resolve(workspaceRoot),
  };
}

async function managerFor(
  ctx: ProjectMemoryToolContext,
  loadManager: ProjectMemoryManagerLoader,
): Promise<MemorySearchManager> {
  const loaded = await loadManager({
    cfg: runtimeConfig(ctx),
    agentId: ctx.agentId?.trim() || "main",
  });
  if (!loaded.manager) {
    throw new Error(`sg-project-memory-manager-unavailable: ${loaded.error ?? "unknown"}`);
  }
  return loaded.manager;
}

function projectRoot(workspaceRoot: string): string {
  const root = path.resolve(workspaceRoot, PROJECT_ROOT);
  if (!inside(workspaceRoot, root)) {
    throw new Error("sg-project-memory-root-invalid");
  }
  return root;
}

function parseMetadata(content: string): ProjectRecordMetadata | undefined {
  const firstLine = content.split(/\r?\n/u, 1)[0]?.trim();
  if (!firstLine?.startsWith(METADATA_PREFIX) || !firstLine.endsWith(" -->")) {
    return undefined;
  }
  try {
    const value = JSON.parse(
      firstLine.slice(METADATA_PREFIX.length, -" -->".length).trim(),
    ) as Partial<ProjectRecordMetadata>;
    if (
      value.schemaVersion !== 1 ||
      typeof value.id !== "string" ||
      typeof value.lineageId !== "string" ||
      (value.recordType !== "decision" &&
        value.recordType !== "incident" &&
        value.recordType !== "task") ||
      typeof value.title !== "string" ||
      typeof value.status !== "string" ||
      typeof value.actorGlobalId !== "string" ||
      typeof value.recordedAt !== "string" ||
      typeof value.channel !== "string" ||
      typeof value.senderId !== "string" ||
      !Array.isArray(value.projectKeys) ||
      !value.projectKeys.every((entry) => typeof entry === "string") ||
      !Array.isArray(value.sourceRefs) ||
      !value.sourceRefs.every((entry) => typeof entry === "string")
    ) {
      return undefined;
    }
    return value as ProjectRecordMetadata;
  } catch {
    return undefined;
  }
}

async function collectMarkdownFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(target)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(target);
    }
  }
  return files;
}

async function readRecords(workspaceRoot: string): Promise<StoredProjectRecord[]> {
  const root = projectRoot(workspaceRoot);
  const records: StoredProjectRecord[] = [];
  for (const absolutePath of await collectMarkdownFiles(root)) {
    if (!inside(root, absolutePath)) {
      continue;
    }
    const content = await readFile(absolutePath, "utf8");
    const metadata = parseMetadata(content);
    if (!metadata) {
      continue;
    }
    records.push({
      metadata,
      absolutePath,
      relativePath: portable(path.relative(workspaceRoot, absolutePath)),
      content,
    });
  }
  return records;
}

function recordLinks(records: StoredProjectRecord[]) {
  const supersededBy = new Map<string, string>();
  for (const record of records) {
    if (record.metadata.supersedesId) {
      supersededBy.set(record.metadata.supersedesId, record.metadata.id);
    }
  }
  return supersededBy;
}

function renderRecord(params: {
  metadata: ProjectRecordMetadata;
  summary: string;
  rationale?: string;
}): string {
  const { metadata } = params;
  const projectAnnotation = `<!-- project: ${metadata.projectKeys.join(";")} -->`;
  const lines = [
    `${METADATA_PREFIX}${JSON.stringify(metadata)} -->`,
    projectAnnotation,
    `# ${metadata.title.replace(/\s*\r?\n\s*/gu, " ")}`,
    "",
    "## Summary",
    params.summary,
  ];
  if (params.rationale) {
    lines.push("", "## Rationale", params.rationale);
  }
  if (metadata.sourceRefs.length > 0) {
    lines.push("", "## Sources", ...metadata.sourceRefs.map((source) => `- ${source}`));
  }
  if (metadata.runtimeTaskId || metadata.runtimeFlowId) {
    lines.push("", "## OpenClaw task references");
    if (metadata.runtimeTaskId) {
      lines.push(`- taskId: ${metadata.runtimeTaskId}`);
    }
    if (metadata.runtimeFlowId) {
      lines.push(`- flowId: ${metadata.runtimeFlowId}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function normalizeHitPath(hit: MemorySearchResult): string {
  return hit.path.replaceAll("\\", "/");
}

function publicRecord(
  record: StoredProjectRecord,
  supersededBy: Map<string, string>,
) {
  const replacement = supersededBy.get(record.metadata.id);
  return {
    ...record.metadata,
    effectiveStatus: replacement ? "superseded" : record.metadata.status,
    ...(replacement ? { supersededBy: replacement } : {}),
    path: record.relativePath,
  };
}

export function createProjectMemoryTools(
  ctx: ProjectMemoryToolContext,
  stateDir: string,
  loadManager: ProjectMemoryManagerLoader = getActiveMemorySearchManager,
) {
  return [
    {
      name: "sg_project_memory_record",
      label: "SG Project Memory Record",
      description:
        "Creates an immutable Monarch-only Project SG decision, incident, or task record. Use supersedesId to create a new version without destroying history.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          recordType: { type: "string", enum: ["decision", "incident", "task"] },
          title: { type: "string", minLength: 1, maxLength: 300 },
          summary: { type: "string", minLength: 1, maxLength: 12000 },
          rationale: { type: "string", minLength: 1, maxLength: 12000 },
          status: {
            type: "string",
            enum: [
              "active",
              "revoked",
              "open",
              "mitigated",
              "resolved",
              "planned",
              "in_progress",
              "blocked",
              "done",
              "cancelled",
            ],
          },
          sourceRefs: {
            type: "array",
            maxItems: 20,
            items: { type: "string", minLength: 1, maxLength: 1000 },
          },
          supersedesId: { type: "string", minLength: 1, maxLength: 200 },
          runtimeTaskId: { type: "string", minLength: 1, maxLength: 200 },
          runtimeFlowId: { type: "string", minLength: 1, maxLength: 200 },
        },
        required: ["recordType", "title", "summary"],
      },
      execute: async (_toolCallId: string, params: Record<string, unknown>) => {
        try {
          const actor = await resolveActor(ctx, stateDir);
          const recordType = recordTypeParam(params);
          const title = requiredText(params, "title", 300).replace(/\s*\r?\n\s*/gu, " ");
          const summary = requiredText(params, "summary", 12000);
          const rationale = optionalText(params, "rationale", 12000);
          if (recordType === "decision" && !rationale) {
            throw new Error("sg-project-memory-rationale-required");
          }
          const runtimeTaskId = optionalText(params, "runtimeTaskId", 200);
          const runtimeFlowId = optionalText(params, "runtimeFlowId", 200);
          if (recordType !== "task" && (runtimeTaskId || runtimeFlowId)) {
            throw new Error("sg-project-memory-task-reference-invalid");
          }

          const records = await readRecords(actor.workspaceRoot);
          const supersededBy = recordLinks(records);
          const supersedesId = optionalText(params, "supersedesId", 200);
          const previous = supersedesId
            ? records.find((record) => record.metadata.id === supersedesId)
            : undefined;
          if (supersedesId && !previous) {
            throw new Error("sg-project-memory-superseded-record-not-found");
          }
          if (previous && previous.metadata.recordType !== recordType) {
            throw new Error("sg-project-memory-supersession-type-mismatch");
          }
          if (previous && supersededBy.has(previous.metadata.id)) {
            throw new Error("sg-project-memory-record-already-superseded");
          }

          const id = `pm3-${Date.now()}-${randomUUID()}`;
          const projectKeys = [
            PROJECT_KEY,
            ...(ctx.activeProjectKeys ?? []).map((key) => key.trim()).filter(Boolean),
          ].filter((key, index, values) => values.indexOf(key) === index);
          const metadata: ProjectRecordMetadata = {
            schemaVersion: 1,
            id,
            lineageId: previous?.metadata.lineageId ?? id,
            recordType,
            title,
            status: statusParam(params, recordType),
            actorGlobalId: actor.globalId,
            recordedAt: new Date().toISOString(),
            channel: actor.channel,
            senderId: actor.senderId,
            projectKeys,
            sourceRefs: optionalStringArray(params, "sourceRefs", 20, 1000),
            ...(supersedesId ? { supersedesId } : {}),
            ...(runtimeTaskId ? { runtimeTaskId } : {}),
            ...(runtimeFlowId ? { runtimeFlowId } : {}),
          };
          const directory = path.join(
            projectRoot(actor.workspaceRoot),
            TYPE_DIRECTORIES[recordType],
          );
          await mkdir(directory, { recursive: true });
          const absolutePath = path.join(directory, `${id}.md`);
          if (!inside(projectRoot(actor.workspaceRoot), absolutePath)) {
            throw new Error("sg-project-memory-path-invalid");
          }
          await writeFile(
            absolutePath,
            renderRecord({ metadata, summary, ...(rationale ? { rationale } : {}) }),
            { encoding: "utf8", flag: "wx", mode: 0o600 },
          );
          const manager = await managerFor(ctx, loadManager);
          await manager.sync?.({ reason: "sg-project-memory-write", force: true });
          return jsonResult({
            status: "created",
            record: {
              ...metadata,
              effectiveStatus: metadata.status,
              path: portable(path.relative(actor.workspaceRoot, absolutePath)),
            },
          });
        } catch (error) {
          return jsonResult({
            status: "denied",
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
    {
      name: "sg_project_memory_search",
      label: "SG Project Memory Search",
      description:
        "Searches only Monarch-visible Project SG records through the existing OpenClaw Memory Core index.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string", minLength: 1, maxLength: 1000 },
          recordType: { type: "string", enum: ["decision", "incident", "task"] },
          includeSuperseded: { type: "boolean" },
          maxResults: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["query"],
      },
      execute: async (_toolCallId: string, params: Record<string, unknown>) => {
        try {
          const actor = await resolveActor(ctx, stateDir);
          const query = requiredText(params, "query", 1000);
          const requestedType =
            params.recordType === undefined ? undefined : recordTypeParam(params);
          const includeSuperseded = params.includeSuperseded === true;
          const maxResults = positiveInteger(params, "maxResults", 6, 20);
          const records = await readRecords(actor.workspaceRoot);
          const recordsByPath = new Map(records.map((record) => [record.relativePath, record]));
          const supersededBy = recordLinks(records);
          const manager = await managerFor(ctx, loadManager);
          await manager.sync?.({ reason: "sg-project-memory-search" });
          const hits = await manager.search(query, {
            maxResults: Math.min(80, maxResults * 4),
            sessionKey: ctx.sessionKey,
            sources: ["memory"],
            activeProjectKeys: [
              PROJECT_KEY,
              ...(ctx.activeProjectKeys ?? []).map((key) => key.trim()).filter(Boolean),
            ],
          });
          const seen = new Set<string>();
          const results = hits.flatMap((hit) => {
            const hitPath = normalizeHitPath(hit);
            if (!hitPath.startsWith(`${PROJECT_ROOT}/`)) {
              return [];
            }
            const record = recordsByPath.get(hitPath);
            if (!record || seen.has(record.metadata.id)) {
              return [];
            }
            if (requestedType && record.metadata.recordType !== requestedType) {
              return [];
            }
            const replacement = supersededBy.get(record.metadata.id);
            if (replacement && !includeSuperseded) {
              return [];
            }
            seen.add(record.metadata.id);
            return [
              {
                ...publicRecord(record, supersededBy),
                score: hit.score,
                snippet: hit.snippet,
              },
            ];
          });
          return jsonResult({
            status: "ok",
            results: results.slice(0, maxResults),
          });
        } catch (error) {
          return jsonResult({
            status: "denied",
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
    {
      name: "sg_project_memory_get",
      label: "SG Project Memory Get",
      description:
        "Reads one Project SG record by immutable record id through OpenClaw Memory Core.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          recordId: { type: "string", minLength: 1, maxLength: 200 },
        },
        required: ["recordId"],
      },
      execute: async (_toolCallId: string, params: Record<string, unknown>) => {
        try {
          const actor = await resolveActor(ctx, stateDir);
          const recordId = requiredText(params, "recordId", 200);
          const records = await readRecords(actor.workspaceRoot);
          const record = records.find((candidate) => candidate.metadata.id === recordId);
          if (!record) {
            return jsonResult({ status: "not_found", recordId });
          }
          const manager = await managerFor(ctx, loadManager);
          await manager.sync?.({ reason: "sg-project-memory-get" });
          const result = await manager.readFile({ relPath: record.relativePath });
          return jsonResult({
            status: result.status,
            record: publicRecord(record, recordLinks(records)),
            text: result.text,
          });
        } catch (error) {
          return jsonResult({
            status: "denied",
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
  ];
}
