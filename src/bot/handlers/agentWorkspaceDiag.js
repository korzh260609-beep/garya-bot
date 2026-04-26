// src/bot/handlers/agentWorkspaceDiag.js

import agentWorkspaceReportService from "../../agentWorkspace/AgentWorkspaceReportService.js";

export async function handleAgentWorkspaceDiag({ bot, chatId, bypass }) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  try {
    const diag = agentWorkspaceReportService.getDiag();

    await bot.sendMessage(
      chatId,
      [
        "AgentWorkspace diag",
        `enabled=${String(diag.enabled)}`,
        `dryRun=${String(diag.dryRun)}`,
        `hasGithubToken=${String(diag.hasGithubToken)}`,
        `ready=${String(diag.ready)}`,
        `repoFullName=${diag.repoFullName}`,
        `branch=${diag.branch}`,
        `basePath=${diag.basePath}`,
        `allowedFiles=${(diag.allowedFiles || []).join(",")}`,
      ].join("\n")
    );
  } catch (error) {
    await bot.sendMessage(
      chatId,
      `Ошибка AgentWorkspace diag: ${error?.message || "unknown_error"}`
    );
  }
}

export default {
  handleAgentWorkspaceDiag,
};
