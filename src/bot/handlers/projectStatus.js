// src/bot/handlers/projectStatus.js
// Stage 6 — Roadmap Awareness (SKELETON ONLY, READ-ONLY)

export async function handleProjectStatus({ bot, chatId }) {
  await bot.sendMessage(
    chatId,
    [
      "PROJECT_STATUS: DISABLED (skeleton only)",
      "Reason: Roadmap Awareness reporting not enabled",
      "Scope: read-only",
    ].join("\n")
  );
}
