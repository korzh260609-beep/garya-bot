import { readFile } from "node:fs/promises";
import type { OpenClawConfig } from "openclaw/plugin-sdk/config-contracts";
import { getActiveMemorySearchManager } from "openclaw/plugin-sdk/memory-host-search";
import type {
  AnyAgentTool,
  OpenClawPluginApi,
  OpenClawPluginToolContext,
} from "openclaw/plugin-sdk/plugin-entry";
import { jsonResult } from "openclaw/plugin-sdk/tool-results";
import { resolveWorkspaceContext } from "./context.js";
import { createProjectMemoryTools, type ProjectMemoryToolContext } from "./project-memory-tools.js";

type AutomaticProjectMemoryApi = {
  config?: OpenClawPluginApi["config"];
  logger?: { warn(message: string): void };
  on: OpenClawPluginApi["on"];
};

type LiveEvidenceSource = "github_actions" | "github_repository" | "render";

type CachedAgentContext = {
  accountId?: string;
  activeProjectKeys?: string[];
  agentId?: string;
  channel?: string;
  channelId?: string;
  runId?: string;
  senderId?: string;
  sessionKey?: string;
  liveRequirements?: Set<LiveEvidenceSource>;
  verifiedLiveSources?: Set<LiveEvidenceSource>;
  workspaceDir?: string;
};

type ProjectHandoffEvent = {
  eventId: string;
  eventType: string;
  recordType: "decision" | "incident" | "task";
  title: string;
  summary: string;
  rationale?: string;
  status: string;
  sourceRefs: string[];
  supersedesEventId?: string;
  runtimeTaskId?: string;
  runtimeFlowId?: string;
};

type ProjectHandoff = {
  schemaVersion: 1;
  handoffId: string;
  projectKey: string;
  authority: { kind: "monarch-approved"; globalId: string };
  events: ProjectHandoffEvent[];
};

type ProjectBootstrap = Omit<ProjectHandoff, "authority"> & {
  authority: { kind: "canonical-project-artifact" };
  repository: { fullName: string; branch: string };
};

type RepositoryProjectHandoff = Omit<ProjectHandoff, "authority"> & {
  authority: { kind: "canonical-project-artifact" };
};

type RepositoryHandoffManifest = {
  schemaVersion: 1;
  repository: { fullName: string; branch: string };
  handoffs: RepositoryProjectHandoff[];
};

type ToolResult = { details?: unknown };

const PROJECT_PROMPT_PATTERN =
  /\b(?:sg|openclaw|github|render|deploy|commit|actions|repository|project|roadmap)\b|(?:проект|репозитор|депло|коммит|памят|задач|решени|инцидент)/iu;
const CURRENT_FACT_PATTERN =
  /\b(?:current|currently|latest|now|head|live|status|deployed)\b|(?:сейчас|текущ|актуаль|последн|статус|разв[её]рнут|работает ли)/iu;
const GITHUB_REPOSITORY_PATTERN =
  /\b(?:github|repository|repo|branch|commit|head|sha)\b|(?:github|репозитор|ветк|коммит|head|sha)/iu;
const GITHUB_ACTIONS_PATTERN =
  /\b(?:github actions|actions|workflow|ci)\b|(?:actions|workflow|ci|сборк)/iu;
const RENDER_PATTERN = /\b(?:render|deploy|deployed|live)\b|(?:render|депло|разв[её]рнут|live)/iu;
const UNVERIFIED_ANSWER_PATTERN =
  /(?:не (?:проверено|подтверждено|удалось проверить)|нет актуальной проверки|текущий статус неизвестен|not verified|unverified|could not verify)/iu;
const GITHUB_MUTATION_PATTERN =
  /(?:\bgit\s+(?:push|commit|merge|rebase|reset|checkout|switch|clean)\b|\bgh\s+(?:pr\s+(?:merge|create)|repo\s+(?:create|delete)|workflow\s+run)\b)/iu;
const GITHUB_REPOSITORY_READ_PATTERN =
  /(?:\bgit\s+(?:rev-parse|status|branch|log|show|ls-remote)\b|\bgh\s+(?:repo\s+view|api\s+repos\/))/iu;
const GITHUB_ACTIONS_READ_PATTERN =
  /(?:\bgh\s+run\s+(?:list|view|watch)\b|\bgh\s+api\s+[^\s]*actions\/runs)/iu;
const SECRET_PATTERN =
  /(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:password|passwd|token|secret|api[_-]?key)\s*[:=]\s*[^\s,;]{8,})/iu;
const BOOTSTRAP_SOURCE_PATTERN =
  /^(?:github:commit:[0-9a-f]{40}|github:actions:[0-9]+:success|render:deploy:[a-z0-9-]+:live|roadmap:SG22_FULL_OPENCLAW_CAPABILITY_INHERITANCE\.md#[a-z0-9._-]+)$/u;
const CANONICAL_REPOSITORY = "korzh260609-beep/garya-bot";
const CANONICAL_BRANCH = "dev/sg2.2-openclaw";
const MAX_BOOTSTRAP_BYTES = 256 * 1024;
const MAX_REPOSITORY_HANDOFF_BYTES = 512 * 1024;
const REPOSITORY_HANDOFF_URL =
  "https://api.github.com/repos/korzh260609-beep/garya-bot/contents/pillars/project-memory/SG22_PROJECT_MEMORY_HANDOFFS.json?ref=dev%2Fsg2.2-openclaw";

export const PROJECT_HANDOFF_TOOL_NAMES = ["sg_project_handoff"] as const;

export const PROJECT_HANDOFF_AGENT_GUIDANCE = [
  "SG — автоматический мост проектной памяти",
  "После подтверждённого результата разработки передай структурированный handoff через sg_project_handoff.",
  "Не вызывай инструмент для обычного разговора, неподтверждённых предложений или данных без источников.",
  "Не проси монарха отдельно говорить «запомни».",
].join("\n");

const EVENT_CONTRACT: Record<
  string,
  { recordType: ProjectHandoffEvent["recordType"]; statuses: readonly string[] }
> = {
  "decision.approved": { recordType: "decision", statuses: ["active"] },
  "decision.revoked": { recordType: "decision", statuses: ["revoked"] },
  "task.created": { recordType: "task", statuses: ["planned"] },
  "task.started": { recordType: "task", statuses: ["in_progress"] },
  "task.blocked": { recordType: "task", statuses: ["blocked"] },
  "task.completed": { recordType: "task", statuses: ["done"] },
  "task.cancelled": { recordType: "task", statuses: ["cancelled"] },
  "commit.verified": { recordType: "task", statuses: ["in_progress", "done"] },
  "actions.completed": { recordType: "task", statuses: ["in_progress", "done"] },
  "deploy.live": { recordType: "task", statuses: ["done"] },
  "incident.opened": { recordType: "incident", statuses: ["open"] },
  "incident.mitigated": { recordType: "incident", statuses: ["mitigated"] },
  "incident.fixed": { recordType: "incident", statuses: ["resolved"] },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function containsSecret(value: unknown): boolean {
  try {
    return SECRET_PATTERN.test(JSON.stringify(value));
  } catch {
    return true;
  }
}

function hasRequiredEvidence(
  event: ProjectHandoffEvent,
  evidenceSource: "live-handoff" | "canonical-bootstrap",
): boolean {
  if (event.sourceRefs.length === 0) {
    return false;
  }
  if (
    evidenceSource === "canonical-bootstrap" &&
    !event.sourceRefs.every((sourceRef) => BOOTSTRAP_SOURCE_PATTERN.test(sourceRef))
  ) {
    return false;
  }
  switch (event.eventType) {
    case "decision.approved":
    case "decision.revoked":
      return event.sourceRefs.some((sourceRef) =>
        evidenceSource === "canonical-bootstrap"
          ? sourceRef.startsWith("roadmap:")
          : sourceRef.startsWith("owner-approved:"),
      );
    case "commit.verified":
      return event.sourceRefs.some((sourceRef) => /^github:commit:[0-9a-f]{40}$/u.test(sourceRef));
    case "actions.completed":
      return event.sourceRefs.some((sourceRef) =>
        /^github:actions:[^:]+:success$/u.test(sourceRef),
      );
    case "deploy.live":
      return event.sourceRefs.some((sourceRef) => /^render:deploy:[^:]+:live$/u.test(sourceRef));
    default:
      return true;
  }
}

function parseHandoffEvent(
  value: unknown,
  evidenceSource: "live-handoff" | "canonical-bootstrap" = "live-handoff",
): ProjectHandoffEvent | undefined {
  if (!isRecord(value) || containsSecret(value)) {
    return undefined;
  }
  const contract =
    typeof value.eventType === "string" ? EVENT_CONTRACT[value.eventType] : undefined;
  if (
    !contract ||
    value.recordType !== contract.recordType ||
    typeof value.status !== "string" ||
    !contract.statuses.includes(value.status) ||
    !boundedText(value.eventId, 200) ||
    !boundedText(value.title, 300) ||
    !boundedText(value.summary, 12_000) ||
    !Array.isArray(value.sourceRefs) ||
    value.sourceRefs.length > 20 ||
    !value.sourceRefs.every((sourceRef) => boundedText(sourceRef, 1_000)) ||
    (value.rationale !== undefined && !boundedText(value.rationale, 12_000)) ||
    (value.supersedesEventId !== undefined && !boundedText(value.supersedesEventId, 200)) ||
    (value.runtimeTaskId !== undefined && !boundedText(value.runtimeTaskId, 200)) ||
    (value.runtimeFlowId !== undefined && !boundedText(value.runtimeFlowId, 200))
  ) {
    return undefined;
  }
  const event = value as ProjectHandoffEvent;
  if (event.recordType === "decision" && !event.rationale) {
    return undefined;
  }
  return hasRequiredEvidence(event, evidenceSource) ? event : undefined;
}

function parseHandoff(value: unknown): ProjectHandoff | undefined {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !boundedText(value.handoffId, 200) ||
    value.projectKey !== "project-sg" ||
    !isRecord(value.authority) ||
    value.authority.kind !== "monarch-approved" ||
    !boundedText(value.authority.globalId, 200) ||
    !Array.isArray(value.events) ||
    value.events.length === 0 ||
    value.events.length > 100
  ) {
    return undefined;
  }
  return value as ProjectHandoff;
}

function parseBootstrap(value: unknown): ProjectBootstrap | undefined {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !boundedText(value.handoffId, 200) ||
    value.projectKey !== "project-sg" ||
    !isRecord(value.authority) ||
    value.authority.kind !== "canonical-project-artifact" ||
    !isRecord(value.repository) ||
    value.repository.fullName !== CANONICAL_REPOSITORY ||
    value.repository.branch !== CANONICAL_BRANCH ||
    !Array.isArray(value.events) ||
    value.events.length === 0 ||
    value.events.length > 100 ||
    containsSecret(value)
  ) {
    return undefined;
  }
  if (!value.events.every((event) => parseHandoffEvent(event, "canonical-bootstrap"))) {
    return undefined;
  }
  return value as ProjectBootstrap;
}

function parseRepositoryHandoff(value: unknown): RepositoryProjectHandoff | undefined {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !boundedText(value.handoffId, 200) ||
    value.projectKey !== "project-sg" ||
    !isRecord(value.authority) ||
    value.authority.kind !== "canonical-project-artifact" ||
    !Array.isArray(value.events) ||
    value.events.length === 0 ||
    value.events.length > 100 ||
    containsSecret(value) ||
    !value.events.every((event) => parseHandoffEvent(event, "live-handoff"))
  ) {
    return undefined;
  }
  return value as RepositoryProjectHandoff;
}

function parseRepositoryHandoffManifest(value: unknown): RepositoryHandoffManifest | undefined {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isRecord(value.repository) ||
    value.repository.fullName !== CANONICAL_REPOSITORY ||
    value.repository.branch !== CANONICAL_BRANCH ||
    !Array.isArray(value.handoffs) ||
    value.handoffs.length > 100 ||
    !value.handoffs.every((handoff) => parseRepositoryHandoff(handoff))
  ) {
    return undefined;
  }
  return value as RepositoryHandoffManifest;
}

export function validateCanonicalProjectMemoryBootstrap(value: unknown): boolean {
  return parseBootstrap(value) !== undefined;
}

export function createProjectHandoffTool(
  ctx: OpenClawPluginToolContext,
  stateDir: string,
): AnyAgentTool {
  return {
    name: "sg_project_handoff",
    label: "SG Project Handoff",
    description:
      "Validates a trusted Monarch-approved structured project-development handoff so the native Project Memory hook can record verified decisions, tasks, commits, CI, deploys, and incidents automatically.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "handoffId", "projectKey", "authority", "events"],
      properties: {
        schemaVersion: { type: "integer", enum: [1] },
        handoffId: { type: "string", minLength: 1, maxLength: 200 },
        projectKey: { type: "string", enum: ["project-sg"] },
        authority: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "globalId"],
          properties: {
            kind: { type: "string", enum: ["monarch-approved"] },
            globalId: { type: "string", minLength: 1, maxLength: 200 },
          },
        },
        events: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "eventId",
              "eventType",
              "recordType",
              "title",
              "summary",
              "status",
              "sourceRefs",
            ],
            properties: {
              eventId: { type: "string", minLength: 1, maxLength: 200 },
              eventType: { type: "string", enum: Object.keys(EVENT_CONTRACT) },
              recordType: { type: "string", enum: ["decision", "incident", "task"] },
              title: { type: "string", minLength: 1, maxLength: 300 },
              summary: { type: "string", minLength: 1, maxLength: 12000 },
              rationale: { type: "string", minLength: 1, maxLength: 12000 },
              status: { type: "string", minLength: 1, maxLength: 100 },
              sourceRefs: {
                type: "array",
                minItems: 1,
                maxItems: 20,
                items: { type: "string", minLength: 1, maxLength: 1000 },
              },
              supersedesEventId: { type: "string", minLength: 1, maxLength: 200 },
              runtimeTaskId: { type: "string", minLength: 1, maxLength: 200 },
              runtimeFlowId: { type: "string", minLength: 1, maxLength: 200 },
            },
          },
        },
      },
    },
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      try {
        const handoff = parseHandoff(params);
        if (!handoff || ctx.senderIsOwner !== true) {
          return jsonResult({ status: "denied", reason: "sg-project-handoff-untrusted" });
        }
        const runtimeConfig = (ctx.runtimeConfig ?? ctx.config ?? {}) as OpenClawConfig;
        const actor = await resolveWorkspaceContext(
          {
            channel: ctx.messageChannel ?? "",
            accountId: ctx.agentAccountId,
            to: ctx.nativeChannelId,
            senderId: ctx.requesterSenderId,
            identityLinks: runtimeConfig.session?.identityLinks,
          },
          stateDir,
        );
        if (
          actor.projectRole !== "monarch" ||
          !actor.globalId ||
          actor.globalId !== handoff.authority.globalId
        ) {
          return jsonResult({ status: "denied", reason: "sg-project-memory-monarch-required" });
        }
        return jsonResult({ status: "verified", sgProjectMemoryHandoff: handoff });
      } catch (error) {
        return jsonResult({
          status: "denied",
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}

let canonicalBootstrapPromise: Promise<ProjectBootstrap | undefined> | undefined;

function loadCanonicalBootstrap(): Promise<ProjectBootstrap | undefined> {
  canonicalBootstrapPromise ??= readFile(
    new URL("./project-memory-bootstrap.json", import.meta.url),
    "utf8",
  )
    .then((content) => {
      if (Buffer.byteLength(content, "utf8") > MAX_BOOTSTRAP_BYTES) {
        return undefined;
      }
      return parseBootstrap(JSON.parse(content) as unknown);
    })
    .catch(() => undefined);
  return canonicalBootstrapPromise;
}

async function loadRepositoryHandoffs(): Promise<RepositoryProjectHandoff[]> {
  try {
    const response = await fetch(REPOSITORY_HANDOFF_URL, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "sg-project-memory-bridge",
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as unknown;
    if (
      !isRecord(payload) ||
      payload.encoding !== "base64" ||
      typeof payload.content !== "string"
    ) {
      return [];
    }
    const content = Buffer.from(payload.content.replace(/\s/gu, ""), "base64").toString("utf8");
    if (Buffer.byteLength(content, "utf8") > MAX_REPOSITORY_HANDOFF_BYTES) {
      return [];
    }
    return parseRepositoryHandoffManifest(JSON.parse(content) as unknown)?.handoffs ?? [];
  } catch {
    return [];
  }
}

function resultDetails(result: unknown): Record<string, unknown> | undefined {
  if (!isRecord(result)) {
    return undefined;
  }
  if (isRecord(result.details)) {
    return result.details;
  }
  return result;
}

async function executeProjectTool(
  ctx: ProjectMemoryToolContext,
  stateDir: string,
  name: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> {
  const tool = createProjectMemoryTools(ctx, stateDir).find((candidate) => candidate.name === name);
  if (!tool) {
    return undefined;
  }
  const result = (await tool.execute(`automatic-${name}`, params)) as ToolResult;
  return isRecord(result.details) ? result.details : undefined;
}

async function recordHandoffEvents(
  api: AutomaticProjectMemoryApi,
  stateDir: string,
  toolContext: ProjectMemoryToolContext,
  handoff: Pick<ProjectHandoff, "handoffId" | "events">,
  source: "live-handoff" | "canonical-bootstrap",
): Promise<boolean> {
  let complete = true;
  for (const rawEvent of handoff.events) {
    const projectEvent = parseHandoffEvent(rawEvent, source);
    if (!projectEvent) {
      api.logger?.warn("[sg-project-memory] rejected unsafe or unverified project event");
      complete = false;
      continue;
    }
    const result = await executeProjectTool(toolContext, stateDir, "sg_project_memory_record", {
      recordType: projectEvent.recordType,
      title: projectEvent.title,
      summary: projectEvent.summary,
      ...(projectEvent.rationale ? { rationale: projectEvent.rationale } : {}),
      status: projectEvent.status,
      sourceRefs: projectEvent.sourceRefs,
      sourceEventId: projectEvent.eventId,
      sourceEventType: projectEvent.eventType,
      sourceHandoffId: handoff.handoffId,
      ...(projectEvent.supersedesEventId
        ? { supersedesEventId: projectEvent.supersedesEventId }
        : {}),
      ...(projectEvent.runtimeTaskId ? { runtimeTaskId: projectEvent.runtimeTaskId } : {}),
      ...(projectEvent.runtimeFlowId ? { runtimeFlowId: projectEvent.runtimeFlowId } : {}),
    });
    if (result?.status !== "created" && result?.status !== "duplicate") {
      api.logger?.warn(
        `[sg-project-memory] automatic event ${projectEvent.eventId} was not recorded`,
      );
      complete = false;
    }
  }
  return complete;
}

function projectToolContext(
  api: AutomaticProjectMemoryApi,
  ctx: CachedAgentContext,
): ProjectMemoryToolContext | undefined {
  if (!ctx.channel || !ctx.senderId || !ctx.workspaceDir) {
    return undefined;
  }
  return {
    config: api.config,
    messageChannel: ctx.channel,
    agentAccountId: ctx.accountId,
    nativeChannelId: ctx.channelId,
    requesterSenderId: ctx.senderId,
    workspaceDir: ctx.workspaceDir,
    agentId: ctx.agentId,
    sessionKey: ctx.sessionKey,
    activeProjectKeys: ctx.activeProjectKeys,
  };
}

function cacheKey(ctx: CachedAgentContext): string | undefined {
  return ctx.runId?.trim() || ctx.sessionKey?.trim();
}

function liveRequirements(prompt: string): Set<LiveEvidenceSource> {
  const required = new Set<LiveEvidenceSource>();
  if (!CURRENT_FACT_PATTERN.test(prompt)) {
    return required;
  }
  if (GITHUB_REPOSITORY_PATTERN.test(prompt)) {
    required.add("github_repository");
  }
  if (GITHUB_ACTIONS_PATTERN.test(prompt)) {
    required.add("github_actions");
  }
  if (RENDER_PATTERN.test(prompt)) {
    required.add("render");
  }
  if (required.size === 0 && PROJECT_PROMPT_PATTERN.test(prompt)) {
    required.add("github_repository");
    required.add("github_actions");
    required.add("render");
  }
  return required;
}

function toolResultSucceeded(event: { error?: string; result?: unknown }): boolean {
  if (event.error) {
    return false;
  }
  const details = resultDetails(event.result);
  const status = details?.status;
  if (
    typeof status === "string" &&
    ["denied", "error", "invalid_request", "not_found", "unavailable"].includes(status)
  ) {
    return false;
  }
  const exitCode = details?.exitCode ?? details?.exit_code;
  return typeof exitCode !== "number" || exitCode === 0;
}

function markVerifiedLiveSources(
  cached: CachedAgentContext | undefined,
  event: { toolName: string; params: Record<string, unknown>; error?: string; result?: unknown },
): void {
  if (!cached || !toolResultSucceeded(event)) {
    return;
  }
  const verified = cached.verifiedLiveSources ?? new Set<LiveEvidenceSource>();
  cached.verifiedLiveSources = verified;
  if (event.toolName === "exec") {
    const command =
      typeof event.params.command === "string"
        ? event.params.command
        : typeof event.params.cmd === "string"
          ? event.params.cmd
          : "";
    if (!GITHUB_MUTATION_PATTERN.test(command)) {
      if (GITHUB_REPOSITORY_READ_PATTERN.test(command)) {
        verified.add("github_repository");
      }
      if (GITHUB_ACTIONS_READ_PATTERN.test(command)) {
        verified.add("github_actions");
      }
    }
    return;
  }
  if (
    /(?:^|__)github(?:__|_)/u.test(event.toolName) &&
    /(?:get|list|search|view|status)/u.test(event.toolName) &&
    !/(?:create|update|delete|merge|publish)/u.test(event.toolName)
  ) {
    verified.add("github_repository");
    if (/(?:action|workflow|run)/u.test(event.toolName)) {
      verified.add("github_actions");
    }
    return;
  }
  const renderAction = event.params.action;
  if (
    event.toolName === "sg_render" &&
    typeof renderAction === "string" &&
    ["get_service", "list_deploys", "get_deploy", "logs", "metrics"].includes(renderAction)
  ) {
    verified.add("render");
  }
}

function formatRecall(
  records: Record<string, unknown>[],
  requiredLiveSources: ReadonlySet<LiveEvidenceSource>,
  allowedTools: { exec: boolean; render: boolean },
): string | undefined {
  const blocks = records
    .slice(0, 4)
    .map((record) => {
      const title = typeof record.title === "string" ? record.title : "Project record";
      const body =
        typeof record.text === "string"
          ? record.text
          : typeof record.snippet === "string"
            ? record.snippet
            : "";
      return `### ${title}\n${body.slice(0, 3_500)}`;
    })
    .filter((block) => block.length > 0);
  if (blocks.length === 0 && requiredLiveSources.size === 0) {
    return undefined;
  }
  const liveInstructions: string[] = [];
  if (requiredLiveSources.has("github_repository")) {
    liveInstructions.push(
      allowedTools.exec
        ? "- GitHub/repository: выполни read-only проверку через штатный exec с git/gh."
        : "- GitHub/repository: штатный exec недоступен; обозначь текущий статус как не проверенный.",
    );
  }
  if (requiredLiveSources.has("github_actions")) {
    liveInstructions.push(
      allowedTools.exec
        ? "- GitHub Actions: проверь нужный workflow run через штатный exec с gh."
        : "- GitHub Actions: штатный exec недоступен; обозначь текущий статус как не проверенный.",
    );
  }
  if (requiredLiveSources.has("render")) {
    liveInstructions.push(
      allowedTools.render
        ? "- Render: проверь сервис/deploy read-only действием sg_render."
        : "- Render: sg_render недоступен; обозначь текущий статус как не проверенный.",
    );
  }
  return [
    "SG — автоматически найденная проектная память",
    "Историческая память не является доказательством текущего состояния. Записи ниже используются только как контекст.",
    ...(liveInstructions.length > 0
      ? [
          "Обязательная проверка изменяемых фактов перед ответом:",
          ...liveInstructions,
          "Если проверка не выполнена, прямо скажи «не проверено» и не называй память текущим фактом.",
        ]
      : []),
    ...blocks,
  ].join("\n\n");
}

export function registerAutomaticProjectMemory(
  api: AutomaticProjectMemoryApi,
  stateDir: string,
): void {
  const runContexts = new Map<string, CachedAgentContext>();
  const bootstrappedActors = new Set<string>();

  api.on(
    "before_prompt_build",
    async (event, ctx) => {
      const cached: CachedAgentContext = {
        accountId: ctx.accountId,
        activeProjectKeys: ctx.activeProjectKeys,
        agentId: ctx.agentId,
        channel: ctx.channel ?? ctx.messageProvider,
        channelId: ctx.chatId ?? ctx.channelId,
        runId: ctx.runId,
        senderId: ctx.senderId,
        sessionKey: ctx.sessionKey,
        liveRequirements: liveRequirements(event.prompt),
        verifiedLiveSources: new Set<LiveEvidenceSource>(),
        workspaceDir: ctx.workspaceDir,
      };
      const key = cacheKey(cached);
      if (key) {
        runContexts.set(key, cached);
        if (runContexts.size > 256) {
          const oldest = runContexts.keys().next().value;
          if (typeof oldest === "string") {
            runContexts.delete(oldest);
          }
        }
      }
      if (!PROJECT_PROMPT_PATTERN.test(event.prompt)) {
        return undefined;
      }
      ctx.toolAuthority?.assertActive();
      const toolContext = projectToolContext(api, cached);
      if (!toolContext) {
        return undefined;
      }
      try {
        const runtimeConfig = (api.config ?? {}) as OpenClawConfig;
        const actor = await resolveWorkspaceContext(
          {
            channel: cached.channel,
            accountId: cached.accountId,
            to: cached.channelId,
            senderId: cached.senderId,
            identityLinks: runtimeConfig.session?.identityLinks,
          },
          stateDir,
        ).catch(() => undefined);
        if (
          actor?.projectRole === "monarch" &&
          actor.globalId &&
          !bootstrappedActors.has(actor.globalId)
        ) {
          const bootstrap = await loadCanonicalBootstrap();
          if (
            bootstrap &&
            (await recordHandoffEvents(
              api,
              stateDir,
              toolContext,
              bootstrap,
              "canonical-bootstrap",
            ))
          ) {
            bootstrappedActors.add(actor.globalId);
          }
        }
        if (actor?.projectRole === "monarch" && actor.globalId) {
          for (const handoff of await loadRepositoryHandoffs()) {
            await recordHandoffEvents(api, stateDir, toolContext, handoff, "live-handoff");
          }
        }
        const search = await executeProjectTool(toolContext, stateDir, "sg_project_memory_search", {
          query: event.prompt,
          maxResults: 4,
        });
        if (search?.status !== "ok") {
          return undefined;
        }
        let records = Array.isArray(search?.results) ? search.results.filter(isRecord) : [];
        if (records.length === 0) {
          const fallback = await executeProjectTool(
            toolContext,
            stateDir,
            "sg_project_memory_search",
            { query: "memory", maxResults: 4 },
          );
          records = Array.isArray(fallback?.results) ? fallback.results.filter(isRecord) : [];
        }
        const recalled = formatRecall(records, cached.liveRequirements ?? new Set(), {
          exec: ctx.toolAuthority?.allows("exec") ?? false,
          render: ctx.toolAuthority?.allows("sg_render") ?? false,
        });
        return recalled ? { prependContext: recalled } : undefined;
      } catch (error) {
        api.logger?.warn(
          `[sg-project-memory] automatic recall failed safely: ${error instanceof Error ? error.message : String(error)}`,
        );
        return undefined;
      }
    },
    { requiresToolAuthority: true },
  );

  api.on("after_tool_call", async (event, ctx) => {
    const key = event.runId?.trim() || ctx.runId?.trim() || ctx.sessionKey?.trim();
    const cached = key ? runContexts.get(key) : undefined;
    markVerifiedLiveSources(cached, event);
    if (event.toolName !== "sg_project_handoff" || ctx.requester?.senderIsOwner !== true) {
      return;
    }
    const wrapper = resultDetails(event.result);
    if (wrapper?.status !== "verified") {
      return;
    }
    const handoff = parseHandoff(wrapper.sgProjectMemoryHandoff);
    if (!handoff) {
      api.logger?.warn("[sg-project-memory] rejected invalid automatic handoff");
      return;
    }
    if (!cached?.workspaceDir || !ctx.requester.channel || !ctx.requester.senderId) {
      return;
    }
    const runtimeConfig = (api.config ?? {}) as OpenClawConfig;
    const actor = await resolveWorkspaceContext(
      {
        channel: ctx.requester.channel,
        accountId: ctx.requester.accountId,
        to: cached.channelId,
        senderId: ctx.requester.senderId,
        identityLinks: runtimeConfig.session?.identityLinks,
      },
      stateDir,
    ).catch(() => undefined);
    if (
      actor?.projectRole !== "monarch" ||
      !actor.globalId ||
      actor.globalId !== handoff.authority.globalId
    ) {
      return;
    }
    const toolContext = projectToolContext(api, {
      ...cached,
      accountId: ctx.requester.accountId,
      channel: ctx.requester.channel,
      senderId: ctx.requester.senderId,
    });
    if (!toolContext) {
      return;
    }
    await recordHandoffEvents(api, stateDir, toolContext, handoff, "live-handoff");
  });

  api.on("before_agent_finalize", (event, ctx) => {
    const key = event.runId?.trim() || ctx.runId?.trim() || event.sessionKey?.trim();
    const cached = key ? runContexts.get(key) : undefined;
    const required = cached?.liveRequirements;
    if (!required || required.size === 0) {
      return undefined;
    }
    const verified = cached.verifiedLiveSources ?? new Set<LiveEvidenceSource>();
    const missing = [...required].filter((source) => !verified.has(source));
    if (missing.length === 0 || UNVERIFIED_ANSWER_PATTERN.test(event.lastAssistantMessage ?? "")) {
      return undefined;
    }
    const labels: Record<LiveEvidenceSource, string> = {
      github_actions: "GitHub Actions",
      github_repository: "GitHub/repository",
      render: "Render",
    };
    return {
      action: "revise" as const,
      reason: `Не подтверждены изменяемые проектные факты: ${missing.map((source) => labels[source]).join(", ")}.`,
      retry: {
        instruction:
          "Перед финальным ответом выполни доступные read-only проверки через штатные exec/git/gh и sg_render. Если источник недоступен, явно напиши «не проверено» и не выдавай историческую память за текущее состояние.",
        idempotencyKey: `sg-project-memory-live-proof:${key ?? "unknown"}`,
        maxAttempts: 1,
      },
    };
  });

  api.on("gateway_start", async (_event, ctx) => {
    try {
      const loaded = await getActiveMemorySearchManager({
        cfg: ctx.config ?? api.config ?? {},
        agentId: "main",
      });
      await loaded.manager?.sync?.({ reason: "sg-project-memory-startup", force: true });
    } catch (error) {
      api.logger?.warn(
        `[sg-project-memory] startup synchronization failed safely: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  api.on("agent_end", (_event, ctx) => {
    const key = cacheKey({ runId: ctx.runId, sessionKey: ctx.sessionKey });
    if (key) {
      runContexts.delete(key);
    }
  });
}
