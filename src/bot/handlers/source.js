// src/bot/handlers/source.js
// Extracted from messageRouter.js case "/source" (no logic changes)

import { fetchFromSourceKey } from "../../sources/sources.js";

export async function handleSource({
  bot,
  chatId,
  rest,
  userRole,
  userPlan,
  bypass,
}) {
  const key = (rest || "").trim();
  if (!key) {
    await bot.sendMessage(chatId, "Использование: /source <key>");
    return;
  }

  const result = await fetchFromSourceKey(key, {
    userRole,
    userPlan,
    bypassPermissions: bypass,
  });

  if (!result.ok) {
    await bot.sendMessage(
      chatId,
      `❌ Ошибка при обращении к источнику <code>${key}</code>:\n<code>${
        result.error || "Unknown error"
      }</code>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  await bot.sendMessage(chatId, JSON.stringify(result, null, 2).slice(0, 3500));
  return;
}
