// src/bot/handlers/demoTask.js
// Handler for /demo_task — extracted from messageRouter.js with NO behavior changes.

export async function handleDemoTask({ bot, chatId, chatIdStr, createDemoTask }) {
  const id = await createDemoTask(chatIdStr);
  await bot.sendMessage(chatId, `✅ Демо-задача создана!\nID: ${id}`);
}

