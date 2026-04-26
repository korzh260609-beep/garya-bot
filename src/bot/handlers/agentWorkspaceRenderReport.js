// src/bot/handlers/agentWorkspaceRenderReport.js

import agentWorkspaceReportService from "../../agentWorkspace/AgentWorkspaceReportService.js";

export async function handleAgentWorkspaceRenderReport({
  bot,
  chatId,
  senderIdStr,
  rest,
  bypass,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  try {
    const result = await agentWorkspaceReportService.collectRenderReport(
      rest || "",
      senderIdStr || "global"
    );

    await bot.sendMessage(
      chatId,
      [
        "✅ AgentWorkspace Render report written.",
        `taskId=${result.taskId}`,
        `workflowPoint=${result.workflowPoint}`,
        `deployId=${result.deployId || "-"}`,
        `commit=${result.commit || "-"}`,
        `logs=${result.logs}`,
        `diagnosis=${String(result.diagnosis)}`,
        `writes=${(result.writes || []).length}`,
        `lastCommit=${(result.writes || []).map((x) => x.commitSha).filter(Boolean).slice(-1)[0] || "-"}`,
      ].join("\n")
    );
  } catch (error) {
    await bot.sendMessage(
      chatId,
      `Ошибка AgentWorkspace render report: ${error?.message || "unknown_error"}`
    );
  }
}

export default {
  handleAgentWorkspaceRenderReport,
};
