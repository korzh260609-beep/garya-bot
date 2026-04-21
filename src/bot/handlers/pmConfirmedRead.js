// src/bot/handlers/pmConfirmedRead.js
// ============================================================================
// Project Memory confirmed read flow
// Purpose:
// - thin Telegram adapter for confirmed project memory reads
// - no business logic here
// - call universal confirmed reader and render simple text
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function parseArgs(rest = "") {
  const tokens = safeText(rest).split(/\s+/).filter(Boolean);

  const out = {
    limit: null,
    moduleKey: null,
    stageKey: null,
    section: null,
    entryType: null,
  };

  for (const token of tokens) {
    const lower = token.toLowerCase();

    if (/^\d+$/.test(token)) {
      out.limit = Number.parseInt(token, 10);
      continue;
    }

    if (lower.startsWith("module:")) {
      out.moduleKey = safeText(token.slice(7));
      continue;
    }

    if (lower.startsWith("stage:")) {
      out.stageKey = safeText(token.slice(6));
      continue;
    }

    if (lower.startsWith("section:")) {
      out.section = safeText(token.slice(8));
      continue;
    }

    if (lower.startsWith("type:")) {
      out.entryType = safeText(token.slice(5));
      continue;
    }
  }

  return out;
}

function buildFilterLabel(args = {}) {
  const parts = [];

  if (args.moduleKey) parts.push(`module=${args.moduleKey}`);
  if (args.stageKey) parts.push(`stage=${args.stageKey}`);
  if (args.section) parts.push(`section=${args.section}`);
  if (args.entryType) parts.push(`type=${args.entryType}`);

  return parts.length ? ` [${parts.join(", ")}]` : "";
}

function compactText(text, maxChars = 220) {
  const s = safeText(text);
  if (!s) return "";
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + "...";
}

export async function handlePmConfirmedList({
  bot,
  chatId,
  rest,
  listConfirmedProjectMemoryEntries,
}) {
  if (typeof listConfirmedProjectMemoryEntries !== "function") {
    await bot.sendMessage(chatId, "⛔ listConfirmedProjectMemoryEntries недоступен.");
    return;
  }

  try {
    const args = parseArgs(rest);
    const limit = Number.isInteger(args.limit) ? args.limit : 10;

    const rows = await listConfirmedProjectMemoryEntries({
      limit,
      moduleKey: args.moduleKey,
      stageKey: args.stageKey,
      section: args.section,
      entryType: args.entryType,
    });

    const filterLabel = buildFilterLabel(args);

    if (!rows.length) {
      await bot.sendMessage(chatId, `🧠 Confirmed memory${filterLabel}: записей нет.`);
      return;
    }

    const lines = [`🧠 Confirmed memory${filterLabel} (последние ${rows.length}):`, ""];

    for (const row of rows) {
      lines.push(`• id=${row.id} | ${safeText(row.entry_type)} | ${safeText(row.section) || "-"}`);
      if (safeText(row.title)) {
        lines.push(`  title: ${safeText(row.title)}`);
      }
      lines.push(`  text: ${compactText(row.content)}`);
      lines.push("");
    }

    await bot.sendMessage(chatId, lines.join("\n").trim());
  } catch (e) {
    console.error("❌ /pm_confirmed_list error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка чтения confirmed project memory.");
  }
}

export async function handlePmConfirmedLatest({
  bot,
  chatId,
  rest,
  getLatestConfirmedProjectMemoryEntry,
}) {
  if (typeof getLatestConfirmedProjectMemoryEntry !== "function") {
    await bot.sendMessage(chatId, "⛔ getLatestConfirmedProjectMemoryEntry недоступен.");
    return;
  }

  try {
    const args = parseArgs(rest);

    const row = await getLatestConfirmedProjectMemoryEntry({
      moduleKey: args.moduleKey,
      stageKey: args.stageKey,
      section: args.section,
      entryType: args.entryType,
    });

    const filterLabel = buildFilterLabel(args);

    if (!row) {
      await bot.sendMessage(chatId, `🧠 Confirmed latest${filterLabel}: записей нет.`);
      return;
    }

    const lines = [
      `🧠 Confirmed latest${filterLabel}:`,
      "",
      `id: ${row.id}`,
      `entry_type: ${safeText(row.entry_type) || "-"}`,
      `section: ${safeText(row.section) || "-"}`,
      `title: ${safeText(row.title) || "-"}`,
      `module_key: ${safeText(row.module_key) || "-"}`,
      `stage_key: ${safeText(row.stage_key) || "-"}`,
      "",
      safeText(row.content) || "-",
    ];

    await bot.sendMessage(chatId, lines.join("\n"));
  } catch (e) {
    console.error("❌ /pm_confirmed_latest error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка чтения latest confirmed memory.");
  }
}

export async function handlePmConfirmedDigest({
  bot,
  chatId,
  rest,
  buildConfirmedProjectMemoryDigest,
}) {
  if (typeof buildConfirmedProjectMemoryDigest !== "function") {
    await bot.sendMessage(chatId, "⛔ buildConfirmedProjectMemoryDigest недоступен.");
    return;
  }

  try {
    const args = parseArgs(rest);

    const digest = await buildConfirmedProjectMemoryDigest({
      limit: Number.isInteger(args.limit) ? args.limit : 50,
      moduleKey: args.moduleKey,
      stageKey: args.stageKey,
      section: args.section,
      entryType: args.entryType,
    });

    const lines = [
      `🧠 Confirmed digest${buildFilterLabel(args)}:`,
      "",
      `total: ${digest.totalEntries}`,
      `sections: ${(digest.sections || []).join(", ") || "-"}`,
      `types: ${(digest.entryTypes || []).join(", ") || "-"}`,
      `modules: ${(digest.moduleKeys || []).join(", ") || "-"}`,
      `stages: ${(digest.stageKeys || []).join(", ") || "-"}`,
      `paths: ${(digest.relatedPaths || []).slice(0, 10).join(", ") || "-"}`,
    ];

    await bot.sendMessage(chatId, lines.join("\n"));
  } catch (e) {
    console.error("❌ /pm_confirmed_digest error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка чтения confirmed digest.");
  }
}

export default {
  handlePmConfirmedList,
  handlePmConfirmedLatest,
  handlePmConfirmedDigest,
};
