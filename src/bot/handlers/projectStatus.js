// ============================================================================
// src/bot/handlers/projectStatus.js
// Stage 6 — Project Status (SKELETON)
// READ-ONLY / NO SIDE EFFECTS
// ============================================================================

export async function handleProjectStatus({ bot, chatId }) {
  await bot.sendMessage(
    chatId,
    [
      "PROJECT STATUS",
      "stage: 6",
      "repo: connected",
      "health: ok",
      "project_status: handler active",
    ].join("\n")
  );
}
