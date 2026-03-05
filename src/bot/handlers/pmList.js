// src/bot/handlers/pmList.js
// ✅ STAGE 7A — Project Memory: list sections

export async function handlePmList({ bot, chatId, rest, getProjectMemoryList }) {
  const raw = String(rest || "").trim();
  const sectionFilter = raw ? raw.split(/\s+/)[0].trim() : null;

  const rows = await getProjectMemoryList(undefined, sectionFilter || null);

  if (!rows || rows.length === 0) {
    const msg = sectionFilter
      ? `🧠 Project Memory: секция "${sectionFilter}" не найдена.`
      : "🧠 Project Memory: секций пока нет.";
    await bot.sendMessage(chatId, msg);
    return;
  }

  // unique sections
  const sections = [];
  const seen = new Set();
  for (const r of rows) {
    const s = String(r.section || "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    sections.push(s);
  }

  // fallback: if sectionFilter given, show that section exists
  if (sectionFilter) {
    const msg = [
      `🧠 Project Memory: "${sectionFilter}"`,
      "",
      "✅ Есть записи (используй /pm_show " + sectionFilter + ")",
    ].join("\n");
    await bot.sendMessage(chatId, msg);
    return;
  }

  const msg = ["🧠 Project Memory sections:", "", ...sections.map((s) => `• ${s}`)].join("\n");

  // Telegram limit safety (4096) — режем мягко
  const out = msg.length > 3800 ? msg.slice(0, 3800) + "\n…(обрезано)" : msg;

  await bot.sendMessage(chatId, out);
}

export default handlePmList;