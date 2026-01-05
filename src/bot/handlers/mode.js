// src/bot/handlers/mode.js
// extracted from case "/mode" — no logic changes

export async function handleMode({
  bot,
  chatId,
  chatIdStr,
  rest,
  setAnswerMode,
}) {
  const modeRaw = (rest || "").trim();
  if (!modeRaw) {
    await bot.sendMessage(chatId, "Использование: /mode short | normal | long");
    return;
  }

  const mode = modeRaw.toLowerCase();
  const valid = ["short", "normal", "long"];

  if (!valid.includes(mode)) {
    await bot.sendMessage(chatId, "Режимы: short / normal / long");
    return;
  }

  setAnswerMode(chatIdStr, mode);
  await bot.sendMessage(chatId, `Режим ответа: ${mode}`);
}

