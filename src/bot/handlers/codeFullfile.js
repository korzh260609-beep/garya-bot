// ============================================================================
// === src/bot/handlers/codeFullfile.js
// === B7.A: /code_fullfile <path> [requirement]
// === READ-ONLY: returns FULL FILE, no auto-write
// ============================================================================

export async function handleCodeFullfile(ctx) {
  const { bot, chatId, rest } = ctx || {};

  const raw = String(rest || "").trim();
  if (!raw) {
    await bot.sendMessage(chatId, "Usage: /code_fullfile <path/to/file.js> [requirement]");
    return;
  }

  // пока только контракт — логики генерации НЕТ
  await bot.sendMessage(
    chatId,
    [
      "code_fullfile: CONTRACT READY",
      "Status: handler exists, logic not implemented yet.",
      "Next: add context сбор (pillars + RepoIndex) and callAI.",
    ].join("\n")
  );
}

