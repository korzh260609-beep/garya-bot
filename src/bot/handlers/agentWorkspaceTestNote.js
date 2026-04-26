// src/bot/handlers/agentWorkspaceTestNote.js

import agentWorkspaceReportService from "../../agentWorkspace/AgentWorkspaceReportService.js";

export async function handleAgentWorkspaceTestNote({
  bot,
  chatId,
  rest,
  bypass,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  try {
    const result = await agentWorkspaceReportService.writeTestNote(rest || "");

    await bot.sendMessage(
      chatId,
      [
        "✅ AgentWorkspace test note written.",
        `taskId=${result.taskId}`,
        `file=${result?.write?.fileName || "TEST_REPORT.md"}`,
        `commit=${result?.write?.commitSha || "-"}`,
      ].join("\n")
    );
  } catch (error) {
    await bot.sendMessage(
      chatId,
      `Ошибка AgentWorkspace test note: ${error?.message || "unknown_error"}`
    );
  }
}

export default {
  handleAgentWorkspaceTestNote,
};
