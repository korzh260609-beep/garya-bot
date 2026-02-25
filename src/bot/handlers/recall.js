// src/bot/handlers/recall.js
// STAGE 8A — RECALL ENGINE (MVP, no embeddings)
// Minimal: date/range + keyword filter over chat_messages
// Also logs observability into interaction_logs: recall_request / recall_error

import pool from "../../../db.js";

function safeInt(n, def) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : def;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeText(s, max = 200) {
  const t = String(s ?? "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) + "…" : t;
}

// Very small parser (MVP):
// /recall [keyword]
// /recall --days 1 [keyword]
// /recall --limit 5 [keyword]
function parseArgs(restRaw) {
  const rest = String(restRaw ?? "").trim();
  const parts = rest ? rest.split(/\s+/) : [];

  let days = 1;
  let limit = 5;

  const keywords = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];

    if (p === "--days" && parts[i + 1]) {
      days = safeInt(parts[i + 1], days);
      i++;
      continue;
    }

    if (p === "--limit" && parts[i + 1]) {
      limit = safeInt(parts[i + 1], limit);
      i++;
      continue;
    }

    keywords.push(p);
  }

  days = clamp(days, 1, 30);
  limit = clamp(limit, 1, 20);

  const keyword = keywords.join(" ").trim();
  return { days, limit, keyword };
}

async function logInteraction({ chatIdStr, taskType, meta = {} }) {
  try {
    await pool.query(
      `
      INSERT INTO interaction_logs (chat_id, task_type, meta)
      VALUES ($1, $2, $3::jsonb)
    `,
      [chatIdStr, taskType, JSON.stringify(meta)]
    );
  } catch (_) {
    // fail-open
  }
}

export async function handleRecall({ bot, chatId, chatIdStr, rest }) {
  const { days, limit, keyword } = parseArgs(rest);

  await logInteraction({
    chatIdStr,
    taskType: "recall_request",
    meta: { days, limit, keyword: safeText(keyword, 80) },
  });

  try {
    // time window
    const r = await pool.query(
      `
      SELECT role, text, created_at
      FROM chat_messages
      WHERE chat_id = $1
        AND created_at >= NOW() - ($2::int * INTERVAL '1 day')
        AND ($3 = '' OR text ILIKE ('%' || $3 || '%'))
      ORDER BY created_at DESC
      LIMIT $4
    `,
      [String(chatIdStr), days, keyword, limit]
    );

    const rows = r?.rows || [];
    if (!rows.length) {
      await bot.sendMessage(
        chatId,
        [
          "RECALL: пусто",
          `days=${days}`,
          `limit=${limit}`,
          keyword ? `keyword=${safeText(keyword, 80)}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
      return;
    }

    const lines = [];
    for (const row of rows.reverse()) {
      const role = String(row.role || "").toLowerCase();
      const prefix = role === "assistant" ? "A:" : role === "user" ? "U:" : `${role}:`;
      const text = safeText(row.text, 400);
      const ts = row.created_at ? new Date(row.created_at).toISOString().slice(0, 16) : "";
      lines.push(`${ts} ${prefix} ${text}`.trim());
    }

    await bot.sendMessage(
      chatId,
      [
        "RECALL:",
        `days=${days}`,
        `limit=${limit}`,
        keyword ? `keyword=${safeText(keyword, 80)}` : "",
        "",
        ...lines,
      ]
        .filter(Boolean)
        .join("\n")
    );
  } catch (e) {
    await logInteraction({
      chatIdStr,
      taskType: "recall_error",
      meta: { msg: safeText(e?.message || "unknown", 160) },
    });

    await bot.sendMessage(chatId, `⛔ recall_error: ${safeText(e?.message || "unknown", 160)}`);
  }
}
