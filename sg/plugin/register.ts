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
  logger?: { warn(message: string): void };
};

type DispatchHookContext = {
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

export function registerWorkspaceManager(api: WorkspacePluginApi): void {
  const stateDir = api.runtime.state.resolveStateDir(process.env);
  const registry = new SgWorkspaceRegistry(stateDir);
  const requests = new SgWorkspaceRequestRegistry(stateDir);
  api.registerTool((ctx) => createWorkspaceTools(ctx, stateDir), {
    names: ["sg_workspace_onboard", "sg_workspace_pending", "sg_workspace_decide"],
  });
  api.on("before_dispatch", async (event, ctx) => {
    if (event.isGroup !== true) {
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
      api.logger?.warn(
        `SG workspace automatic onboarding skipped: missing ${missingContext.join(",")}`,
      );
      return { handled: false };
    }
    try {
      const resourceId = canonicalResourceId(channel, ctx.conversationId);
      const resource = {
        platform: channel,
        accountId: ctx.accountId,
        resourceId,
      };
      if (!(await registry.resolve(resource)) && !(await requests.resolve(resource))) {
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
        if (actor.canonicalIdentity) {
          await requests.create({
            ...resource,
            resourceKind: "group",
            title: `Сообщество ${ctx.conversationId}`,
            initiatorCanonicalIdentity: actor.canonicalIdentity,
            ...(actor.globalId ? { initiatorGlobalId: actor.globalId } : {}),
          });
          return { handled: true, text: ONBOARDING_NOTICE };
        }
      }
    } catch (error) {
      api.logger?.warn(
        `SG workspace automatic onboarding failed safely: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
