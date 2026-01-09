// ============================================================================
// === src/bot/handlers/reindexRepo.js — SKELETON (Repo Index trigger)
// ============================================================================

export async function handleReindexRepo({ bot, chatId }) {
  await bot.sendMessage(
    chatId,
    "RepoIndex: SKELETON. Индексация репозитория ещё не подключена."
  );
}

