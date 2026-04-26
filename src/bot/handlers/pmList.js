// src/bot/handlers/pmList.js
// ✅ STAGE 7A — Project Memory: list sections

import { truncateTelegramText } from "../telegram/telegramTextUtils.js";

const PM_LIST_HANDLER_BUILD = "pm-list-core-2026-04-26-01";
const PM_LIST_HANDLER_PATH = "src/bot/handlers/pmList.js";

export async function handlePmList({ bot, chatId, rest, getProjectMemoryList }) {
  const raw = String(rest || "").trim();
  const sectionFilter = raw ? raw.split(/\s+/)[0].trim() : null;

  const rows = await getProjectMemoryList(undefined, sectionFilter || null);

  if (!rows || rows.length === 0) {
    const msg = sectionFilter
      ? [
          `🧠 Project Memory: секция "${sectionFilter}" не найдена.`,
          "",
          `build: ${PM_LIST_HANDLER_BUILD}`,
          `handlerPath: ${PM_LIST_HANDLER_PATH}`,
        ].join("\n")
      : [
          "🧠 Project Memory: секций пока нет.",
          "",
          `build: ${PM_LIST_HANDLER_BUILD}`,
          `handlerPath: ${PM_LIST_HANDLER_PATH}`,
        ].join("\n");
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
      "",
      `build: ${PM_LIST_HANDLER_BUILD}`,
      `handlerPath: ${PM_LIST_HANDLER_PATH}`,
    ].join("\n");
    await bot.sendMessage(chatId, msg);
    return;
  }

  const msg = [
    "🧠 Project Memory sections:",
    "",
    ...sections.map((s) => `• ${s}`),
    "",
    `build: ${PM_LIST_HANDLER_BUILD}`,
    `handlerPath: ${PM_LIST_HANDLER_PATH}`,
  ].join("\n");

  await bot.sendMessage(chatId, truncateTelegramText(msg));
}

export default handlePmList;
