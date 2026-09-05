import { jsonResult } from "openclaw/plugin-sdk/tool-results";
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
  execute(
    toolCallId: string,
    params: Record<string, unknown>,
  ): Promise<ReturnType<typeof jsonResult>>;
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
  const workspaces = new SgWorkspaceRegistry(stateDir);
  const memberships = new SgWorkspaceMembershipRegistry(stateDir);
  return [
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
        if (!workspaceId)
          return jsonResult({ status: "unavailable", reason: "workspace-not-found" });
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
        if (!workspaceId)
          return jsonResult({ status: "unavailable", reason: "workspace-not-found" });
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
  "Членство в каждом workspace независимо и не следует из гражданства или участия в Telegram-группе.",
  "Для списка участников используй sg_membership_list, для выдачи или отзыва — sg_membership_manage.",
  "Не утверждай, что join/leave Telegram автоматически изменил членство SG: публичного lifecycle hook для этого нет.",
].join("\n");
