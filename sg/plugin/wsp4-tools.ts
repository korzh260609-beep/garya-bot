import { jsonResult } from "openclaw/plugin-sdk/tool-results";
import { SgGlobalProfileRegistry } from "./citizenship-registry.js";
import { resolveWorkspaceContext } from "./context.js";
import { SgWorkspaceMembershipRegistry } from "./workspace-memberships.js";
import { SgWorkspaceRegistry } from "./workspace-registry.js";

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
  execute(toolCallId: string, params: Record<string, unknown>): Promise<ReturnType<typeof jsonResult>>;
};

function textParam(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`sg-wsp4-tool-${key}-required`);
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

async function workspaceIdFor(
  params: Record<string, unknown>,
  actor: Awaited<ReturnType<typeof actorContext>>,
  workspaces: SgWorkspaceRegistry,
): Promise<string | undefined> {
  if (typeof params.workspaceId === "string" && params.workspaceId.trim()) {
    return params.workspaceId.trim();
  }
  if (!actor.channel || !actor.resourceId) return undefined;
  const workspace = await workspaces.resolve({
    platform: actor.channel,
    ...(actor.accountId ? { accountId: actor.accountId } : {}),
    resourceId: actor.resourceId,
    ...(actor.topicId ? { topicId: actor.topicId } : {}),
  });
  return workspace?.workspaceId;
}

export function createWsp4Tools(ctx: ToolContext, stateDir: string): AgentTool[] {
  const citizens = new SgGlobalProfileRegistry(stateDir);
  const workspaces = new SgWorkspaceRegistry(stateDir);
  const memberships = new SgWorkspaceMembershipRegistry(stateDir);
  return [
    {
      name: "sg_citizen_apply",
      label: "Заявка на гражданство SG",
      description:
        "Подаёт заявку текущего пользователя на гражданство SG. Используй, когда гость просит зарегистрировать его или дать ему гражданство. Идентичность всегда берётся из доверенного контекста сообщения.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
      async execute() {
        const actor = await actorContext(ctx, stateDir);
        if (!actor.canonicalIdentity) {
          return jsonResult({ status: "unavailable", reason: "identity-context-missing" });
        }
        const result = await citizens.apply(actor.canonicalIdentity);
        if (result.status === "already_registered") {
          return jsonResult({
            status: result.status,
            globalId: result.profile?.globalId,
            role: result.profile?.role,
          });
        }
        const readback = (await citizens.snapshot()).citizenRequests.find(
          (request) => request.requestId === result.request?.requestId,
        );
        return jsonResult({
          status: "pending",
          requestId: result.request?.requestId,
          operationId: result.request?.operationId,
          readbackVerified: readback?.status === "pending",
          userMessage: "Заявка на гражданство принята и ожидает решения монарха.",
        });
      },
    },
    {
      name: "sg_citizen_pending",
      label: "Ожидающие заявки на гражданство",
      description: "Показывает монарху ожидающие заявки на гражданство SG.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
      async execute() {
        const actor = await actorContext(ctx, stateDir);
        if (actor.projectRole !== "monarch" || !actor.globalId) {
          return jsonResult({ status: "denied", reason: "monarch-required" });
        }
        const requests = await citizens.listPending(actor.globalId);
        return jsonResult({
          status: "ok",
          requests: requests.map((request) => ({
            requestId: request.requestId,
            canonicalIdentity: request.canonicalIdentity,
            createdAt: request.createdAt,
          })),
        });
      },
    },
    {
      name: "sg_citizen_decide",
      label: "Решение по гражданству",
      description: "Одобряет или отклоняет заявку на гражданство. Доступно только монарху.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          requestId: { type: "string", minLength: 1 },
          decision: { type: "string", enum: ["approve", "reject"] },
        },
        required: ["requestId", "decision"],
      },
      async execute(_toolCallId, params) {
        const actor = await actorContext(ctx, stateDir);
        if (actor.projectRole !== "monarch" || !actor.globalId) {
          return jsonResult({ status: "denied", reason: "monarch-required" });
        }
        const decision = textParam(params, "decision");
        if (decision !== "approve" && decision !== "reject") {
          throw new Error("sg-wsp4-tool-decision-invalid");
        }
        const result = await citizens.decide({
          actorGlobalId: actor.globalId,
          requestId: textParam(params, "requestId"),
          decision,
        });
        const snapshot = await citizens.snapshot();
        const readback = snapshot.citizenRequests.find(
          (request) => request.requestId === result.request.requestId,
        );
        const profileVerified =
          decision === "reject" ||
          snapshot.profiles.some(
            (profile) =>
              profile.globalId === result.profile?.globalId &&
              profile.role === "citizen" &&
              profile.status === "active",
          );
        return jsonResult({
          status: result.request.status,
          requestId: result.request.requestId,
          operationId: result.request.operationId,
          globalId: result.profile?.globalId,
          readbackVerified: readback?.status === result.request.status && profileVerified,
        });
      },
    },
    {
      name: "sg_membership_list",
      label: "Участники workspace SG",
      description:
        "Показывает активных участников текущего или указанного workspace. Доступно монарху и владельцу этого workspace.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { workspaceId: { type: "string", minLength: 1 } },
      },
      async execute(_toolCallId, params) {
        const actor = await actorContext(ctx, stateDir);
        if (!actor.globalId) return jsonResult({ status: "denied", reason: "citizen-required" });
        const workspaceId = await workspaceIdFor(params, actor, workspaces);
        if (!workspaceId) return jsonResult({ status: "unavailable", reason: "workspace-not-found" });
        try {
          const items = await memberships.list(actor.globalId, workspaceId);
          return jsonResult({
            status: "ok",
            workspaceId,
            members: items.map((item) => ({ globalId: item.globalId, role: item.role })),
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
      name: "sg_membership_manage",
      label: "Управление участниками workspace SG",
      description:
        "Вручную выдаёт или отзывает членство в текущем или указанном workspace. Доступно только монарху и владельцу этого workspace. Физическое вступление в Telegram-группу не заменяет эту операцию.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          workspaceId: { type: "string", minLength: 1 },
          action: { type: "string", enum: ["grant", "revoke"] },
          targetGlobalId: { type: "string", minLength: 1 },
          role: { type: "string", enum: ["admin", "member"] },
        },
        required: ["action", "targetGlobalId"],
      },
      async execute(_toolCallId, params) {
        const actor = await actorContext(ctx, stateDir);
        if (!actor.globalId) return jsonResult({ status: "denied", reason: "citizen-required" });
        const workspaceId = await workspaceIdFor(params, actor, workspaces);
        if (!workspaceId) return jsonResult({ status: "unavailable", reason: "workspace-not-found" });
        const action = textParam(params, "action");
        try {
          const result =
            action === "grant"
              ? await memberships.grant({
                  actorGlobalId: actor.globalId,
                  workspaceId,
                  targetGlobalId: textParam(params, "targetGlobalId"),
                  role:
                    typeof params.role === "string" && params.role.trim()
                      ? (params.role.trim() as "admin" | "member")
                      : "member",
                })
              : action === "revoke"
                ? await memberships.revoke({
                    actorGlobalId: actor.globalId,
                    workspaceId,
                    targetGlobalId: textParam(params, "targetGlobalId"),
                  })
                : (() => {
                    throw new Error("sg-wsp4-tool-action-invalid");
                  })();
          const membership = result.membership;
          const readback = membership
            ? await memberships.resolve(workspaceId, membership.globalId)
            : undefined;
          return jsonResult({
            status: result.status,
            workspaceId,
            targetGlobalId: membership?.globalId ?? textParam(params, "targetGlobalId"),
            role: membership?.role,
            operationId: membership?.operationId,
            readbackVerified:
              result.status === "not_member" ||
              readback?.status === (action === "grant" ? "active" : "revoked"),
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

export const WSP4_AGENT_GUIDANCE = [
  "Гость не получает гражданство SG автоматически из-за присутствия в группе.",
  "Когда гость просит зарегистрироваться как гражданин, используй sg_citizen_apply.",
  "Когда monarch просит ожидающие заявки на гражданство, используй sg_citizen_pending.",
  "Только monarch принимает решение через sg_citizen_decide.",
  "Членство в каждом workspace независимо и не следует из гражданства или участия в Telegram-группе.",
  "Для списка участников используй sg_membership_list, для выдачи или отзыва — sg_membership_manage.",
  "Не утверждай, что join/leave Telegram автоматически изменил членство SG: публичного lifecycle hook для этого нет.",
].join("\n");
