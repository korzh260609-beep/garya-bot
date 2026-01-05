// src/bot/handlers/sourcesList.js
// extracted from case "/sources" — no logic changes

export async function handleSourcesList({
  bot,
  chatId,
  listSources,
  userRole,
  userPlan,
  bypass,
}) {
  const sources = await listSources({
    userRole,
    userPlan,
    bypassPermissions: bypass,
  });

  if (!sources.length) {
    await bot.sendMessage(chatId, "Источники не найдены.");
    return;
  }

  let out = "📚 Источники:\n\n";
  for (const s of sources) {
    out += `• ${s.key} — ${s.title || s.type}\n`;
  }

  await bot.sendMessage(chatId, out);
}

