import { formatWorkspaceContext, resolveWorkspaceContext } from "./context.js";
import {
  formatWorkspaceResolution,
  SgWorkspaceRegistry,
  type SgWorkspaceResourceKind,
} from "./workspace-registry.js";

type CommandContext = {
  args?: string;
  channel: string;
  accountId?: string;
  to?: string;
  threadParentId?: string;
  messageThreadId?: string | number;
  senderId?: string;
  config: { session?: { identityLinks?: Record<string, string[]> } };
};

type WorkspacePluginApi = {
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
};

export function registerWorkspaceManager(api: WorkspacePluginApi): void {
  const stateDir = api.runtime.state.resolveStateDir(process.env);
  const registry = new SgWorkspaceRegistry(stateDir);
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
  api.registerCommand({
    name: "sg_workspace_register",
    description: "Зарегистрировать текущий ресурс SG (только monarch)",
    requireAuth: false,
    handler: async (ctx) => {
      const context = await resolveWorkspaceContext(
        {
          channel: ctx.channel,
          accountId: ctx.accountId,
          to: ctx.to,
          threadParentId: ctx.threadParentId,
          messageThreadId: ctx.messageThreadId,
          senderId: ctx.senderId,
          identityLinks: ctx.config.session?.identityLinks,
        },
        stateDir,
      );
      if (context.projectRole !== "monarch" || !context.globalId) {
        return { text: "SG Workspace Manager — регистрация разрешена только monarch" };
      }
      const match = ctx.args?.trim().match(/^(group|channel|room|topic)\s+(.+)$/s);
      if (!match) {
        return {
          text: "Использование: /sg_workspace_register <group|channel|room|topic> <название>",
        };
      }
      const resourceId = ctx.threadParentId ?? ctx.to;
      if (!resourceId) {
        return { text: "SG Workspace Manager — ресурс не определён" };
      }
      const resourceKind = match[1] as SgWorkspaceResourceKind;
      const title = match[2] ?? "";
      const workspace = await registry.register({
        platform: ctx.channel,
        ...(ctx.accountId ? { accountId: ctx.accountId } : {}),
        resourceId,
        ...(ctx.messageThreadId !== undefined ? { topicId: String(ctx.messageThreadId) } : {}),
        ...(resourceKind === "topic" ? { parentResourceId: resourceId } : {}),
        resourceKind,
        title,
        ownerGlobalId: context.globalId,
        status: "active",
        settings: {},
      });
      return { text: formatWorkspaceResolution(workspace) };
    },
  });
}
