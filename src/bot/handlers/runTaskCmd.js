// src/bot/handlers/runTaskCmd.js
// extracted from case "/run" — no logic changes

export async function handleRunTaskCmd({
  bot,
  chatId,
  chatIdStr,
  rest,
  access,
  callWithFallback,
  runTask,
}) {
  console.error("DBG /run case hit", {
    hasBot: Boolean(bot),
    chatId,
    chatIdStr,
    rest,
  });

  if (!bot) {
    console.error("❌ /run: bot is undefined");
    return;
  }

  await runTask({
    bot,
    chatId,
    chatIdStr,
    rest,
    access,
    callWithFallback,
  });
}

