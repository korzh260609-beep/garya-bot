// src/bot/handlers/sourcesList.js
// extracted from case "/sources"
// aligned with getAllSourcesSafe() shape

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
  });

  if (!Array.isArray(sources) || sources.length === 0) {
    await bot.sendMessage(chatId, "Источники не найдены.");
    return;
  }

  let out = "📚 Источники:\n\n";

  for (const s of sources) {
    const key = s?.key ? String(s.key) : "unknown";
    const name = s?.name ? String(s.name) : null;
    const type = s?.type ? String(s.type) : "unknown";
    const enabled = s?.enabled === true ? "🟢" : "🔴";

    out += `• ${key} — ${name || type} ${enabled}\n`;
  }

  await bot.sendMessage(chatId, out.trim());
}