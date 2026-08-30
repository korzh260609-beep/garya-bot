import { jsonResult } from "openclaw/plugin-sdk/tool-results";
import { resolveWorkspaceContext } from "./context.js";
import { SgWorkspaceRegistry } from "./workspace-registry.js";
import { SgWorkspaceRequestRegistry } from "./workspace-requests.js";

type ToolContext = {
  config?: { session?: { identityLinks?: Record<string, string[]> } };
  messageChannel?: string;
  agentAccountId?: string;
  nativeChannelId?: string;
  requesterSenderId?: string;
  deliveryContext?: { threadId?: string | number };
};

type AgentTool = {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(
    toolCallId: string,
    params: Record<string, unknown>,
  ): Promise<ReturnType<typeof jsonResult>>;
};

const resourceKindSchema = {
  type: "string",
  enum: ["group", "channel", "room", "topic"],
} as const;

function textParam(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`sg-workspace-tool-${key}-required`);
  }
  return value.trim();
}

async function actorContext(ctx: ToolContext, stateDir: string) {
  return resolveWorkspaceContext(
    {
      channel: ctx.messageChannel ?? "",
      accountId: ctx.agentAccountId,
      to: ctx.nativeChannelId,
      messageThreadId: ctx.deliveryContext?.threadId,
      senderId: ctx.requesterSenderId,
      identityLinks: ctx.config?.session?.identityLinks,
    },
    stateDir,
  );
}

export function createWorkspaceTools(ctx: ToolContext, stateDir: string): AgentTool[] {
  const requests = new SgWorkspaceRequestRegistry(stateDir);
  const workspaces = new SgWorkspaceRegistry(stateDir);
  return [
    {
      name: "sg_workspace_onboard",
      label: "Подключение группы или канала к SG",
      description:
        "Внутренний инструмент SG. Вызывай сам, когда SG впервые работает в незарегистрированной группе, канале, комнате или теме. Пользователь не должен знать технические команды или термин workspace. Добавивший SG считается только инициатором, никогда владельцем без отдельного подтверждения.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          resourceKind: resourceKindSchema,
          title: { type: "string", minLength: 1 },
        },
        required: ["resourceKind", "title"],
      },
      async execute(_toolCallId, params) {
        const actor = await actorContext(ctx, stateDir);
        if (!actor.channel || !actor.resourceId || !actor.senderId || !actor.canonicalIdentity) {
          return jsonResult({ status: "unavailable", reason: "resource-context-missing" });
        }
        const existing = await workspaces.resolve({
          platform: actor.channel,
          accountId: actor.accountId,
          resourceId: actor.resourceId,
          ...(actor.topicId ? { topicId: actor.topicId } : {}),
        });
        if (existing) {
          return jsonResult({ status: "already_registered", workspaceId: existing.workspaceId });
        }
        const request = await requests.create({
          platform: actor.channel,
          ...(actor.accountId ? { accountId: actor.accountId } : {}),
          resourceId: actor.resourceId,
          ...(actor.topicId ? { topicId: actor.topicId } : {}),
          resourceKind: textParam(params, "resourceKind") as "group" | "channel" | "room" | "topic",
          title: textParam(params, "title"),
          initiatorCanonicalIdentity: actor.canonicalIdentity,
          ...(actor.globalId ? { initiatorGlobalId: actor.globalId } : {}),
        });
        return jsonResult({
          status: request.status,
          requestId: request.requestId,
          userMessage:
            "Я обнаружил новое сообщество и передал запрос на подключение. Сообщу после подтверждения владельца.",
          ownerAssigned: false,
        });
      },
    },
    {
      name: "sg_workspace_pending",
      label: "Заявки на подключение SG",
      description:
        "Показывает monarch ожидающие заявки. Не используй технические термины в ответе пользователю.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
      async execute() {
        const actor = await actorContext(ctx, stateDir);
        if (actor.projectRole !== "monarch" || !actor.globalId) {
          return jsonResult({ status: "denied", reason: "monarch-required" });
        }
        const pending = await requests.listPending();
        return jsonResult({
          status: "ok",
          requests: pending.map((request) => ({
            requestId: request.requestId,
            title: request.title,
            resourceKind: request.resourceKind,
            initiatorGlobalId: request.initiatorGlobalId,
            ownerAssigned: false,
          })),
        });
      },
    },
    {
      name: "sg_workspace_decide",
      label: "Решение по подключению SG",
      description:
        "Внутреннее решение monarch по заявке. При одобрении ownerGlobalId должен принадлежать подтверждённому владельцу ресурса, а не человеку, который просто добавил SG.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          requestId: { type: "string", minLength: 1 },
          decision: { type: "string", enum: ["approve", "reject"] },
          ownerGlobalId: { type: "string", minLength: 1 },
        },
        required: ["requestId", "decision"],
      },
      async execute(_toolCallId, params) {
        const actor = await actorContext(ctx, stateDir);
        if (actor.projectRole !== "monarch" || !actor.globalId) {
          return jsonResult({ status: "denied", reason: "monarch-required" });
        }
        const requestId = textParam(params, "requestId");
        const decision = textParam(params, "decision");
        if (decision === "reject") {
          const request = await requests.reject({
            requestId,
            decidedByGlobalId: actor.globalId,
          });
          return jsonResult({ status: request.status, requestId });
        }
        if (decision !== "approve") {
          throw new Error("sg-workspace-tool-decision-invalid");
        }
        const result = await requests.approve({
          requestId,
          decidedByGlobalId: actor.globalId,
          ownerGlobalId: textParam(params, "ownerGlobalId"),
          workspaces,
        });
        return jsonResult({
          status: result.request.status,
          requestId,
          workspaceId: result.workspace.workspaceId,
          ownerGlobalId: result.workspace.ownerGlobalId,
        });
      },
    },
  ];
}

export const WSP3_AGENT_GUIDANCE = [
  "SG самостоятельно обнаруживает новые группы, каналы, комнаты и темы.",
  "Пользователь не обязан знать о workspace или командах регистрации.",
  "В незарегистрированном ресурсе автоматически используй sg_workspace_onboard и объясняй результат простыми словами.",
  "Когда monarch просит показать ожидающие заявки на подключение сообществ, обязательно используй sg_workspace_pending и отвечай только по его результату.",
  "Добавивший SG — только инициатор. Никогда не назначай его владельцем без отдельного подтверждения.",
  "Одобрить заявку и указать подтверждённого ownerGlobalId может только monarch через sg_workspace_decide.",
].join("\n");
