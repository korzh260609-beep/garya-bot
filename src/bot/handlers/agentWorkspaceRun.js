// src/bot/handlers/agentWorkspaceRun.js

import agentWorkspaceCommandRunner from "../../agentWorkspace/AgentWorkspaceCommandRunner.js";

export async function handleAgentWorkspaceRun({ bot, chatId, bypass }) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  try {
    const result = await agentWorkspaceCommandRunner.runOnce({
      source: "telegram_manual_run",
    });

    await bot.sendMessage(
      chatId,
      [
        result.ok ? "✅ AgentWorkspace command runner finished." : "⚠️ AgentWorkspace command runner failed.",
        `ok=${String(result.ok)}`,
        `skipped=${String(Boolean(result.skipped))}`,
        `reason=${result.reason || "-"}`,
        `commandId=${result.commandId || "-"}`,
        `action=${result.action || "-"}`,
        `taskId=${result.taskId || "-"}`,
        `workflowPoint=${result.workflowPoint || "-"}`,
        `error=${result.error || "-"}`,
      ].join("\n")
    );
  } catch (error) {
    await bot.sendMessage(
      chatId,
      `Ошибка AgentWorkspace run: ${error?.message || "unknown_error"}`
    );
  }
}

export default {
  handleAgentWorkspaceRun,
};
