import { createHash } from "node:crypto";
import { formatWorkspaceContext, resolveWorkspaceContext } from "./context.js";
import { formatWorkspaceResolution, SgWorkspaceRegistry } from "./workspace-registry.js";
import { SgWorkspaceRequestRegistry } from "./workspace-requests.js";
import { createWorkspaceTools } from "./workspace-tools.js";

type CommandContext = {
  channel: string;
  accountId?: string;
  to?: string;
  threadParentId?: string;
  messageThreadId?: string | number;
  senderId?: string;
  config: { session?: { identityLinks?: Record<string, string[]> } };
};

type WorkspacePluginApi = {
  config?: { session?: { identityLinks?: Record<string, string[]> } };
  runtime: {
    state: {
      resolveStateDir(env?: NodeJS.ProcessEnv): string;
    };
  };
  registerCommand(command: {
    name: string;
    description: string;
    requireAuth: boolean;
    handler(ctx: CommandContext): Promise<{ text: string }>;
  }): void;
  registerTool(
    factory: (
      ctx: Parameters<typeof createWorkspaceTools>[0],
    ) => ReturnType<typeof createWorkspaceTools>,
    options: { names: string[] },
  ): void;
  on(
    hook: "before_dispatch",
    handler: (
      event: { isGroup?: boolean; channel?: string; senderId?: string },
      ctx: DispatchHookContext,
    ) => Promise<{ handled: boolean; text?: string }>,
  ): void;
  logger?: { info(message: string): void; warn(message: string): void };
};

type DispatchHookContext = {
  messageId?: string;
  sessionKey?: string;
  channelId?: string;
  accountId?: string;
  conversationId?: string;
  senderId?: string;
};

const ONBOARDING_NOTICE =
  "Я обнаружил новое сообщество и отправил запрос на подключение. Сообщу после подтверждения владельца.";

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

function trace(api: WorkspacePluginApi, traceId: string, stage: string, result?: string): void {
  api.logger?.info(
    `[sg-workspace] trace=${traceId} stage=${stage}${result ? ` result=${result}` : ""}`,
  );
}

export function registerWorkspaceManager(api: WorkspacePluginApi): void {
  api.logger?.info("[sg-workspace] stage=register-workspace-manager");
  const stateDir =
    process.env.OPENCLAW_STATE_DIR?.trim() || api.runtime.state.resolveStateDir(process.env);
  api.logger?.info("[sg-workspace] stage=resolve-state-dir");
  const registry = new SgWorkspaceRegistry(stateDir);
  const requests = new SgWorkspaceRequestRegistry(stateDir);
  api.logger?.info("[sg-workspace] stage=register-tools");
  api.registerTool((ctx) => createWorkspaceTools(ctx, stateDir), {
    names: ["sg_workspace_onboard", "sg_workspace_pending", "sg_workspace_decide"],
  });
  api.logger?.info("[sg-workspace] stage=register-tools-complete");
  api.logger?.info("[sg-workspace] stage=register-before-dispatch");
  api.on("before_dispatch", async (event, ctx) => {
    const traceId = traceIdFor(ctx.messageId);
    trace(api, traceId, "hook-enter");
    if (event.isGroup !== true) {
      trace(api, traceId, "context-check", "direct-chat");
      trace(api, traceId, "dispatch-handle", "false");
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
      return { handled: false };
    }
    trace(api, traceId, "context-check", "valid");
    try {
      const resourceId = canonicalResourceId(channel, ctx.conversationId);
      const resource = {
        platform: channel,
        accountId: ctx.accountId,
        resourceId,
      };
      const workspace = await registry.resolve(resource);
      trace(api, traceId, "workspace-lookup", workspace ? "found" : "missing");
      const request = workspace ? undefined : await requests.resolve(resource);
      trace(api, traceId, "request-lookup", request ? "found" : "missing");
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
          return { handled: true, text: ONBOARDING_NOTICE };
        }
      }
    } catch (error) {
      api.logger?.warn(
        `SG workspace automatic onboarding failed safely: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    trace(api, traceId, "dispatch-handle", "false");
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
}
