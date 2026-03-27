// src/bot/handlers/renderErrorsLast.js
// Handler for /render_errors_last — show recent rolling render error snapshots.

import renderOpsStore from "../../logging/RenderOpsStore.js";

function parseArgs(rest) {
  const raw = typeof rest === "string" ? rest.trim() : "";
  if (!raw) {
    return { limit: 5, sourceKey: "render_primary" };
  }

  const tokens = raw.split(/\s+/).filter(Boolean);
  let limit = 5;
  let sourceKey = "render_primary";

  for (const token of tokens) {
    const n = Number(token);
    if (Number.isFinite(n)) {
      limit = Math.max(1, Math.min(Math.trunc(n), 20));
    } else {
      sourceKey = token.trim();
    }
  }

  return { limit, sourceKey };
}

async function sendChunked(bot, chatId, text) {
  const MAX = 3500;
  const full = String(text || "");

  if (full.length <= MAX) {
    await bot.sendMessage(chatId, full);
    return;
  }

  const lines = full.split("\n");
  let chunk = "";

  for (const line of lines) {
    const candidate = chunk ? `${chunk}\n${line}` : line;

    if (candidate.length > MAX) {
      if (chunk) {
        await bot.sendMessage(chatId, chunk);
        chunk = line;
      } else {
        await bot.sendMessage(chatId, line.slice(0, MAX - 1) + "…");
        chunk = "";
      }
    } else {
      chunk = candidate;
    }
  }

  if (chunk) {
    await bot.sendMessage(chatId, chunk);
  }
}

export async function handleRenderErrorsLast({
  bot,
  chatId,
  rest,
  bypass,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  const { limit, sourceKey } = parseArgs(rest);
  const rows = await renderOpsStore.getRecentErrors({ sourceKey, limit });

  if (!rows.length) {
    await bot.sendMessage(
      chatId,
      `render_error_snapshots пусто для sourceKey=${sourceKey}`
    );
    return;
  }

  let out = `🚨 Render errors (last ${rows.length})\nsourceKey=${sourceKey}\n\n`;

  for (const r of rows) {
    out += `#${r.id} | ${new Date(r.created_at).toISOString()}\n`;
    out += `kind=${r.error_kind} severity=${r.severity} confidence=${r.confidence}\n`;
    out += `candidate=${r.candidate_path || "-"} line=${r.exact_line || "-"}\n`;
    out += `headline=${r.error_headline || "-"}\n\n`;
  }

  await sendChunked(bot, chatId, out);
}

export default {
  handleRenderErrorsLast,
};