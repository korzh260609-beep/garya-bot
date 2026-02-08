// src/bot/handlers/health.js
// Stage 5 — Observability V1 (SKELETON ONLY)

export async function handleHealth({ bot, chatId }) {
  await bot.sendMessage(
    chatId,
    [
      "HEALTH: DISABLED (skeleton only)",
      "db: unknown",
      "last_snapshot_id: unknown",
      "last_error_at: unknown",
    ].join("\n")
  );
}

