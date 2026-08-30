import { formatWorkspaceContext, resolveWorkspaceContext } from "./context.js";

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
  registerCommand(command: {
    name: string;
    description: string;
    requireAuth: boolean;
    handler(ctx: CommandContext): Promise<{ text: string }>;
  }): void;
};

export function registerWorkspaceManager(api: WorkspacePluginApi): void {
  api.registerCommand({
    name: "sg_context",
    description: "Показать безопасный диагностический контекст SG",
    requireAuth: false,
    handler: async (ctx) => ({
      text: formatWorkspaceContext(await resolveWorkspaceContext({
        channel: ctx.channel,
        accountId: ctx.accountId,
        to: ctx.to,
        threadParentId: ctx.threadParentId,
        messageThreadId: ctx.messageThreadId,
        senderId: ctx.senderId,
        identityLinks: ctx.config.session?.identityLinks,
      })),
    }),
  });
}
