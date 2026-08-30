import { formatWorkspaceContext, resolveWorkspaceContext } from "./context.js";
import { formatWorkspaceResolution, SgWorkspaceRegistry } from "./workspace-registry.js";
import { SgWorkspaceRequestRegistry } from "./workspace-requests.js";
import { createWorkspaceTools, WSP3_AGENT_GUIDANCE } from "./workspace-tools.js";

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
    hook: "before_prompt_build",
    handler: (
      event: { prompt: string; messages: unknown[] },
      ctx: AgentHookContext,
    ) => Promise<{ appendSystemContext: string }>,
  ): void;
  on(
    hook: "before_agent_reply",
    handler: (
      event: { cleanedBody: string },
      ctx: AgentHookContext,
    ) => { handled: true; reply: { text: string } } | undefined,
  ): void;
  logger?: { warn(message: string): void };
};

type AgentHookContext = {
  runId?: string;
  sessionKey?: string;
  channel?: string;
  accountId?: string;
  chatId?: string;
  senderId?: string;
  channelContext?: { chat?: Record<string, unknown> };
};

const ONBOARDING_NOTICE =
  "Я обнаружил новое сообщество и отправил запрос на подключение. Сообщу после подтверждения владельца.";

function currentRunKey(ctx: AgentHookContext): string | undefined {
  return ctx.runId ?? ctx.sessionKey;
}

function canonicalResourceId(channel: string, chatId: string): string {
  const normalizedChannel = channel.trim().toLowerCase();
  const normalizedChatId = chatId.trim();
  return normalizedChatId.toLowerCase().startsWith(`${normalizedChannel}:`)
    ? normalizedChatId
    : `${normalizedChannel}:${normalizedChatId}`;
}

function isDirectConversation(ctx: AgentHookContext): boolean {
  if (!ctx.chatId || !ctx.senderId) {
    return true;
  }
  const channel = ctx.channel?.trim().toLowerCase();
  const chatId = channel ? ctx.chatId.replace(new RegExp(`^${channel}:`, "i"), "") : ctx.chatId;
  return chatId === ctx.senderId;
}

function readChatText(ctx: AgentHookContext, key: string): string | undefined {
  const value = ctx.channelContext?.chat?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveResourceKind(ctx: AgentHookContext): "group" | "channel" | "room" | "topic" {
  const value = readChatText(ctx, "kind") ?? readChatText(ctx, "type");
  return value && ["group", "channel", "room", "topic"].includes(value)
    ? (value as "group" | "channel" | "room" | "topic")
    : "room";
}

export function registerWorkspaceManager(api: WorkspacePluginApi): void {
  const stateDir = api.runtime.state.resolveStateDir(process.env);
  const registry = new SgWorkspaceRegistry(stateDir);
  const requests = new SgWorkspaceRequestRegistry(stateDir);
  const onboardingNoticeRuns = new Set<string>();
  api.registerTool((ctx) => createWorkspaceTools(ctx, stateDir), {
    names: ["sg_workspace_onboard", "sg_workspace_pending", "sg_workspace_decide"],
  });
  api.on("before_prompt_build", async (_event, ctx) => {
    const runKey = currentRunKey(ctx);
    const missingContext = [
      !runKey ? "runKey" : undefined,
      !ctx.channel ? "channel" : undefined,
      !ctx.chatId ? "chatId" : undefined,
      !ctx.senderId ? "senderId" : undefined,
    ].filter((field): field is string => field !== undefined);
    if (missingContext.length > 0) {
      api.logger?.warn(
        `SG workspace automatic onboarding skipped: missing ${missingContext.join(",")}`,
      );
      return { appendSystemContext: WSP3_AGENT_GUIDANCE };
    }
    if (isDirectConversation(ctx)) {
      return { appendSystemContext: WSP3_AGENT_GUIDANCE };
    }
    try {
      const resourceId = canonicalResourceId(ctx.channel, ctx.chatId);
      const resource = {
        platform: ctx.channel,
        accountId: ctx.accountId,
        resourceId,
      };
      if (!(await registry.resolve(resource)) && !(await requests.resolve(resource))) {
        const actor = await resolveWorkspaceContext(
          {
            channel: ctx.channel,
            accountId: ctx.accountId,
            to: resourceId,
            senderId: ctx.senderId,
            identityLinks: api.config?.session?.identityLinks,
          },
          stateDir,
        );
        if (actor.canonicalIdentity) {
          await requests.create({
            ...resource,
            resourceKind: resolveResourceKind(ctx),
            title:
              readChatText(ctx, "title") ??
              readChatText(ctx, "label") ??
              `Сообщество ${ctx.chatId}`,
            initiatorCanonicalIdentity: actor.canonicalIdentity,
            ...(actor.globalId ? { initiatorGlobalId: actor.globalId } : {}),
          });
          onboardingNoticeRuns.add(runKey);
          return {
            appendSystemContext: `${WSP3_AGENT_GUIDANCE}\nЗаявка уже создана плагином. Не вызывай инструмент повторно. Сообщи пользователю о запросе на подключение.`,
          };
        }
      }
    } catch (error) {
      api.logger?.warn(
        `SG workspace automatic onboarding failed safely: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return { appendSystemContext: WSP3_AGENT_GUIDANCE };
  });
  api.on("before_agent_reply", (_event, ctx) => {
    const runKey = currentRunKey(ctx);
    if (!runKey || !onboardingNoticeRuns.delete(runKey)) {
      return undefined;
    }
    return { handled: true, reply: { text: ONBOARDING_NOTICE } };
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
