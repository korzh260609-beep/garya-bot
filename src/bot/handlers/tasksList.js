// src/bot/handlers/tasksList.js
// extracted from case "/tasks" — no logic changes

export async function handleTasksList({
  bot,
  chatId,
  chatIdStr,
  getUserTasks,
  access,
}) {
  const tasks = await getUserTasks(chatIdStr, 30, access);

  if (!tasks.length) {
    await bot.sendMessage(chatId, "У вас нет задач.");
    return;
  }

  let out = "📋 Ваши задачи:\n\n";
  for (const t of tasks) {
    out += `#${t.id} — ${t.title}\nТип: ${t.type}\nСтатус: ${t.status}\n\n`;
  }

  await bot.sendMessage(chatId, out);
}

