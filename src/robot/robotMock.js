// src/robot/robotMock.js

import pool from "../../db.js";

// ✅ Stage 5 Observability: write task_runs via JobRunner
import { jobRunner } from "../jobs/jobRunnerInstance.js";
import { makeTaskRunKey } from "../jobs/jobRunner.js";

const TICK_MS = 30_000; // тик каждые 30 секунд

function envTrue(name) {
  return String(process.env[name] || "").toLowerCase() === "true";
}

// ============================================================================
// Stage 2.8.1 — SINGLE ROBOT EXECUTION (DB advisory lock)
// Prevent multi-instance duplicate robot loops.
// ============================================================================

const ROBOT_LOCK_KEY = "sg:robot_tick:lock:v1";

async function tryAcquireRobotLock() {
  const client = await pool.connect();
  try {
    // lock is held by this client connection
    const r = await client.query(
      `SELECT pg_try_advisory_lock(hashtext($1)) AS ok;`,
      [ROBOT_LOCK_KEY]
    );
    const ok = !!r?.rows?.[0]?.ok;
    if (!ok) {
      client.release();
      return { ok: false, client: null };
    }
    return { ok: true, client };
  } catch (e) {
    try {
      client.release();
    } catch (_) {}
    return { ok: false, client: null };
  }
}

async function releaseRobotLock(client) {
  if (!client) return;
  try {
    await client.query(`SELECT pg_advisory_unlock(hashtext($1));`, [
      ROBOT_LOCK_KEY,
    ]);
  } catch (_) {
    // ignore
  } finally {
    try {
      client.release();
    } catch (_) {}
  }
}

// ============================================================================
// Stage 2.8.2 — Recover stuck "running" task_runs (crash safety)
// ============================================================================

async function recoverStuckTaskRuns() {
  try {
    // conservative default
    const TIMEOUT_MINUTES = 10;

    await pool.query(
      `
      UPDATE task_runs
      SET
        status = 'failed_timeout',
        fail_reason = 'Auto-timeout recovery',
        retry_at = NOW()
      WHERE status = 'running'
        AND started_at < NOW() - ($1::interval)
      `,
      [`${TIMEOUT_MINUTES} minutes`]
    );
  } catch (e) {
    console.error("❌ ROBOT stuck recovery error:", e?.message || e);
  }
}

export async function getActiveRobotTasks() {
  // ✅ Строго: робот видит ТОЛЬКО active задачи нужных типов
  const res = await pool.query(`
    SELECT id, status, type, schedule, payload, user_global_id
    FROM tasks
    WHERE status = 'active'
      AND type IN ('price_monitor', 'news_monitor')
    ORDER BY id ASC
  `);

  // ❌ console.log запрещён DECISIONS.md — убрали debug-лог полностью
  // Если нужен debug позже — добавим отдельный LoggerService по правилам.

  return res.rows || [];
}

function safeJsonParse(v, fallback = {}) {
  try {
    if (v == null) return fallback;
    if (typeof v === "object") return v;
    return JSON.parse(v);
  } catch (e) {
    return fallback;
  }
}

const mockPriceState = new Map();

function getInitialMockPrice(symbolRaw) {
  const symbol = (symbolRaw || "BTCUSDT").toUpperCase();
  if (symbol.includes("BTC")) return 50000;
  if (symbol.includes("ETH")) return 3000;
  if (symbol.includes("SOL")) return 150;
  if (symbol.includes("XRP")) return 0.6;
  return 100;
}

// -----------------------------
// Safe schema helpers
// -----------------------------
const columnExistsCache = new Map(); // key: "table.column" -> boolean

async function columnExists(table, column) {
  const key = `${table}.${column}`;
  if (columnExistsCache.has(key)) return columnExistsCache.get(key);

  try {
    const res = await pool.query(
      `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1
      `,
      [table, column]
    );
    const ok = (res.rows?.length || 0) > 0;
    columnExistsCache.set(key, ok);
    return ok;
  } catch (e) {
    // Если even information_schema не доступен — считаем, что колонки нет.
    columnExistsCache.set(key, false);
    return false;
  }
}

async function resolveChatIdByGlobalUserId(globalUserId) {
  if (!globalUserId) return null;

  try {
    // ✅ НЕ упоминаем колонку, которой может не быть, иначе Postgres падает.
    const hasGlobalUserId = await columnExists("users", "global_user_id");
    const hasUserGlobalId = await columnExists("users", "user_global_id");

    let where = "";
    const params = [globalUserId];

    if (hasGlobalUserId && hasUserGlobalId) {
      where = "WHERE global_user_id = $1 OR user_global_id = $1";
    } else if (hasGlobalUserId) {
      where = "WHERE global_user_id = $1";
    } else if (hasUserGlobalId) {
      where = "WHERE user_global_id = $1";
    } else {
      // Ни одной колонки нет — значит схема users не соответствует identity-first
      return null;
    }

    const res = await pool.query(
      `
      SELECT chat_id
      FROM users
      ${where}
      LIMIT 1
      `,
      params
    );

    return res.rows?.[0]?.chat_id || null;
  } catch (e) {
    console.error("❌ ROBOT resolveChatId error:", e?.message || e);
    return null;
  }
}

async function isTaskStillActive(taskId) {
  if (!taskId) return false;
  try {
    const res = await pool.query(
      `
      SELECT status
      FROM tasks
      WHERE id = $1
      LIMIT 1
      `,
      [taskId]
    );
    const status = res.rows?.[0]?.status;
    return status === "active";
  } catch (e) {
    return false;
  }
}

// ============================================================================
// === Stage 5.4 — pick due retries from task_runs (scheduler logic) ============
// ============================================================================

async function pickAndRunDueRetries(bot) {
  // Minimal safe limit to avoid storms
  const LIMIT = 5;

  try {
    // Only retry tasks robot can execute (active + supported types)
    const res = await pool.query(
      `
      SELECT
        tr.task_id,
        tr.run_key,
        t.id,
        t.status,
        t.type,
        t.schedule,
        t.payload,
        t.user_global_id
      FROM task_runs tr
      JOIN tasks t ON t.id = tr.task_id
      WHERE tr.status LIKE 'failed%'
        AND tr.retry_at IS NOT NULL
        AND tr.retry_at <= NOW()
        AND t.status = 'active'
        AND t.type IN ('price_monitor', 'news_monitor')
      ORDER BY tr.retry_at ASC
      LIMIT $1
      `,
      [LIMIT]
    );

    const due = res.rows || [];
    if (!due.length) return;

    for (const row of due) {
      const task = {
        id: row.id,
        status: row.status,
        type: row.type,
        schedule: row.schedule,
        payload: row.payload,
        user_global_id: row.user_global_id,
      };

      // idempotencyKey prevents enqueue storms within one process
      const idKey = `retry:${row.task_id}:${row.run_key}`;

      const enq = jobRunner.enqueue(
        {
          taskId: row.task_id,
          runKey: row.run_key, // IMPORTANT: same run_key (re-attempt of same run)
          meta: {
            source: "retry",
            type: task.type,
            originalRunKey: row.run_key,
          },
          task,
        },
        { idempotencyKey: idKey }
      );

      if (!enq.accepted) continue;

      // run immediately (same as normal loop style)
      await jobRunner.runOnce(async (job) => {
        if (job?.task?.type === "price_monitor") {
          await handlePriceMonitorTaskDirect(bot, job.task);
        }
        // news_monitor можно добавить позже
      });
    }
  } catch (e) {
    console.error("❌ ROBOT retry picker error:", e?.message || e);
  }
}

// ============================================================================
// === PRICE MONITOR — DIRECT BUSINESS LOGIC (NO JobRunner inside!) ============
// ============================================================================

async function handlePriceMonitorTaskDirect(bot, task) {
  const payload = safeJsonParse(task.payload, {});
  const symbol = payload.symbol || "BTCUSDT";

  const intervalMinutes =
    typeof payload.interval_minutes === "number" ? payload.interval_minutes : 60;

  const thresholdPercent =
    typeof payload.threshold_percent === "number" ? payload.threshold_percent : 2;

  const now = Date.now();
  let state = mockPriceState.get(task.id);

  if (!state) {
    state = { price: getInitialMockPrice(symbol), lastCheck: now };
    mockPriceState.set(task.id, state);
    return;
  }

  const intervalMs = intervalMinutes * 60_000;
  if (now - state.lastCheck < intervalMs) return;

  // ✅ ВАЖНО: payload.force_fail не должен ломать прод по умолчанию.
  // Разрешаем тест-фейл ТОЛЬКО если включён ENV ROBOT_ALLOW_FORCE_FAIL=true
  if (payload.force_fail === true && envTrue("ROBOT_ALLOW_FORCE_FAIL")) {
    throw new Error("TEST_FAIL: forced by payload.force_fail");
  }

  const randomDelta = (Math.random() - 0.5) * 0.08; // ~ +/-4%
  const newPrice = Math.max(1, state.price * (1 + randomDelta));
  const changePercent = ((newPrice - state.price) / state.price) * 100;

  state.price = newPrice;
  state.lastCheck = now;

  if (Math.abs(changePercent) >= thresholdPercent) {
    // ✅ Анти-гонка: если задачу успели остановить — не шлём сигнал
    const stillActive = await isTaskStillActive(task.id);
    if (!stillActive) return;

    const direction = changePercent > 0 ? "вверх" : "вниз";

    const text =
      `⚠️ Mock-сигнал по задаче #${task.id} (${symbol}).\n` +
      `Изменение: ${changePercent.toFixed(2)}%.\n` +
      `Цена: ${newPrice.toFixed(2)}\n` +
      `Направление: ${direction}.`;

    const userChatId = await resolveChatIdByGlobalUserId(task.user_global_id);
    if (userChatId && bot) {
      // chat_id в БД может быть строкой — Telegram принимает string/number
      await bot.sendMessage(userChatId, text);
    }
  }
}

// ============================================================================
// === PRICE MONITOR — JobRunner wrapper (writes task_runs) ====================
// ============================================================================

async function handlePriceMonitorTask(bot, task) {
  const payload = safeJsonParse(task.payload, {});
  const intervalMinutes =
    typeof payload.interval_minutes === "number" ? payload.interval_minutes : 60;

  const intervalMs = intervalMinutes * 60_000;
  const now = Date.now();

  // ⚠️ IMPORTANT: Do NOT write task_runs if task is not "due".
  // We peek state to decide if it's time.
  let state = mockPriceState.get(task.id);
  if (!state) {
    // same behavior as direct: initialize state and exit
    const symbol = payload.symbol || "BTCUSDT";
    state = { price: getInitialMockPrice(symbol), lastCheck: now };
    mockPriceState.set(task.id, state);
    return;
  }

  if (now - state.lastCheck < intervalMs) return;

  // deterministic run window (for dedup across restarts)
  const scheduledFor = Math.floor(now / intervalMs) * intervalMs;
  const scheduledForIso = new Date(scheduledFor).toISOString();
  const runKey = makeTaskRunKey({ taskId: task.id, scheduledForIso });

  // enqueue into JobRunner so task_runs is written (running/completed/failed)
  const enq = jobRunner.enqueue(
    {
      taskId: task.id,
      runKey,
      meta: {
        source: "robot",
        type: task.type,
        scheduledForIso,
      },
      task,
    },
    { idempotencyKey: runKey }
  );

  // already queued/running in-memory → skip
  if (!enq.accepted) return;

  // run immediately (in-memory worker)
  await jobRunner.runOnce(async (job) => {
    if (job?.task?.type === "price_monitor") {
      await handlePriceMonitorTaskDirect(bot, job.task);
    }
    // news_monitor можно добавить позже
  });
}

export async function robotTick(bot) {
  // Stage 2.8.1: only one instance executes robot tick
  const lock = await tryAcquireRobotLock();
  if (!lock.ok) return;

  try {
    // Stage 2.8.2 — recover stuck "running" runs after crash
    await recoverStuckTaskRuns();

    // ✅ Stage 5.4 — execute due retries first (scheduler responsibility)
    await pickAndRunDueRetries(bot);

    const tasks = await getActiveRobotTasks();
    if (!tasks.length) return;

    for (const t of tasks) {
      try {
        if (t.type === "price_monitor") {
          await handlePriceMonitorTask(bot, t);
        }
        // news_monitor можно добавить позже
      } catch (taskErr) {
        // ✅ коротко, без спама массивами/стеками
        console.error(
          "❌ ROBOT task loop error:",
          t.id,
          taskErr?.message || taskErr
        );
      }
    }
  } catch (err) {
    console.error("❌ ROBOT ERROR:", err?.message || err);
  } finally {
    await releaseRobotLock(lock.client);
  }
}

export function startRobotLoop(bot) {
  robotTick(bot).catch((e) =>
    console.error("❌ ROBOT first tick error:", e?.message || e)
  );

  setInterval(() => {
    robotTick(bot).catch((e) =>
      console.error("❌ ROBOT tick error:", e?.message || e)
    );
  }, TICK_MS);
}
