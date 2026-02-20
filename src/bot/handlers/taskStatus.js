// src/bot/handlers/taskStatus.js
// Stage 5.7 — /task_status (READ-ONLY, safe output)
// Shows latest task_runs with task info.
// Stage 5.4 — surface retry/fail fields when run failed (fail_code/retry_at/max_retries/last_error_at/fail_reason)

import pool from "../../../db.js";

function parseLimit(rest) {
  const raw = String(rest || "").trim();
  if (!raw) return 10;

  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return 10;

  if (n < 1) return 1;
  if (n > 30) return 30;
  return n;
}

function safeLine(s, max = 160) {
  const t = s === null || s === undefined ? "" : String(s);
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// ✅ Kyiv time formatter (Europe/Kyiv)
function formatKyivTs(d) {
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return "unknown";

    const parts = new Intl.DateTimeFormat("uk-UA", {
      timeZone: "Europe/Kyiv",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(dt);

    return `${parts} (Kyiv)`;
  } catch (_) {
    try {
      const dt = d instanceof Date ? d : new Date(d);
      return dt.toISOString() + " (UTC)";
    } catch {
      return "unknown";
    }
  }
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
    const candidate = chunk ? chunk + "\n" + line : line;

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

export async function handleTaskStatus({ bot, chatId, rest }) {
  const limit = parseLimit(rest);

  try {
    // Summary (last 24h)
    const sum = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total_24h,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END)::int AS running_24h,
        SUM(CASE WHEN status LIKE 'failed%' THEN 1 ELSE 0 END)::int AS failed_24h,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::int AS completed_24h
      FROM task_runs
      WHERE started_at >= NOW() - INTERVAL '24 hours'
      `
    );

    const s = sum?.rows?.[0] || {
      total_24h: 0,
      running_24h: 0,
      failed_24h: 0,
      completed_24h: 0,
    };

    // Latest runs + current consecutive failures per task (computed, no schema change)
    const r = await pool.query(
      `
      WITH last_nonfail AS (
        SELECT
          task_id,
          MAX(started_at) AS last_ok_at
        FROM task_runs
        WHERE status NOT LIKE 'failed%'
        GROUP BY task_id
      ),
      fail_streak AS (
        SELECT
          tr.task_id,
          COUNT(*)::int AS fail_streak
        FROM task_runs tr
        LEFT JOIN last_nonfail ln ON ln.task_id = tr.task_id
        WHERE tr.status LIKE 'failed%'
          AND (ln.last_ok_at IS NULL OR tr.started_at > ln.last_ok_at)
        GROUP BY tr.task_id
      )
      SELECT
        tr.id,
        tr.task_id,
        t.title,
        t.type,
        t.status AS task_status,
        tr.run_key,
        tr.status AS run_status,
        tr.attempts,
        tr.started_at,
        tr.finished_at,
        EXTRACT(EPOCH FROM (COALESCE(tr.finished_at, NOW()) - tr.started_at))::int AS duration_sec,
        COALESCE(fs.fail_streak, 0)::int AS fail_streak,

        -- Stage 5.4 fields (may be NULL)
        tr.fail_code,
        tr.retry_at,
        tr.max_retries,
        tr.last_error_at,
        tr.fail_reason

      FROM task_runs tr
      LEFT JOIN tasks t ON t.id = tr.task_id
      LEFT JOIN fail_streak fs ON fs.task_id = tr.task_id
      ORDER BY tr.started_at DESC
      LIMIT $1
      `,
      [limit]
    );

    const rows = r?.rows || [];

    const lines = [];
    lines.push(`TASK_STATUS (last_runs=${rows.length}, limit=${limit})`);
    lines.push(
      `24h: total=${s.total_24h ?? 0} | running=${s.running_24h ?? 0} | completed=${s.completed_24h ?? 0} | failed=${s.failed_24h ?? 0}`
    );

    if (rows.length === 0) {
      lines.push("");
      lines.push("(no task_runs records)");
      await sendChunked(bot, chatId, lines.join("\n"));
      return;
    }

    lines.push("");
    for (const x of rows) {
      const at = x?.started_at ? formatKyivTs(x.started_at) : "unknown";
      const fin = x?.finished_at ? formatKyivTs(x.finished_at) : "-";
      const dur = Number.isFinite(x?.duration_sec) ? `${x.duration_sec}s` : "-";

      const title = safeLine(x?.title || "-", 48);
      const type = safeLine(x?.type || "-", 24);
      const taskSt = safeLine(x?.task_status || "-", 16);

      const runSt = safeLine(x?.run_status || "-", 24);
      const runKey = safeLine(x?.run_key || "-", 60);
      const attempts = x?.attempts ?? 0;
      const failStreak = Number.isFinite(x?.fail_streak) ? x.fail_streak : 0;

      lines.push(
        `#${x.id} task#${x.task_id} | ${type} | task=${taskSt} | run=${runSt} | attempts=${attempts} | fail_streak=${failStreak}`
      );
      lines.push(`- ${title}`);
      lines.push(`- run_key: ${runKey}`);
      lines.push(`- start: ${at} | finish: ${fin} | dur: ${dur}`);

      // ✅ Surface 5.4 only when failed (keeps output compact)
      const isFailed = String(x?.run_status || "").startsWith("failed");
      if (isFailed) {
        const failCode = safeLine(x?.fail_code || "UNKNOWN", 32);
        const retryAt = x?.retry_at ? formatKyivTs(x.retry_at) : "-";
        const maxRetries =
          typeof x?.max_retries === "number" ? String(x.max_retries) : "-";
        const lastErrAt = x?.last_error_at ? formatKyivTs(x.last_error_at) : "-";
        const failReason = safeLine(x?.fail_reason || "-", 220);

        lines.push(`- fail_code: ${failCode} | max_retries: ${maxRetries}`);
        lines.push(`- retry_at: ${retryAt} | last_error_at: ${lastErrAt}`);
        lines.push(`- fail_reason: ${failReason}`);
      }

      lines.push("");
    }

    await sendChunked(bot, chatId, lines.join("\n").trim());
  } catch (e) {
    const msg = `TASK_STATUS\n⛔ cannot read task_runs/tasks (${safeLine(
      e?.message || "unknown error",
      180
    )})`;

    try {
      await sendChunked(bot, chatId, msg);
    } catch (_) {
      // avoid crash loop
    }
  }
}
