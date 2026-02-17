// src/bot/handlers/newTask.js
// Handler for /new_task — identity-first compatible.

function splitTitleNote(rest) {
  const s = String(rest || "").trim();
  if (!s) return { title: "", note: "" };

  const parts = s.split("|");
  if (parts.length === 1) return { title: parts[0].trim(), note: "" };

  const title = (parts[0] || "").trim();
  const note = parts.slice(1).join("|").trim();
  return { title, note };
}

export async function handleNewTask({
  bot,
  chatId,
  chatIdStr,
  rest,
  access,
  callWithFallback,
  createManualTask,
}) {
  try {
    const { title, note } = splitTitleNote(rest);

    if (!title) {
      await bot.sendMessage(chatId, "Использование: /new_task <title> | <note>");
      return;
    }

    const result = await callWithFallback(createManualTask, [
      [chatIdStr, title, note, access],
      [chatIdStr, title, note],
      [chatIdStr, rest, access], // legacy fallback (если где-то старый контракт)
      [chatIdStr, rest],
    ]);

    await bot.sendMessage(
      chatId,
      `🆕 Задача создана!\nID: ${result?.id || result}`
    );
  } catch (e) {
    await bot.sendMessage(chatId, `⛔ ${e?.message || "Запрещено"}`);
  }
}
