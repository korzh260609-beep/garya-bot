// src/robot/robotMock.js
// === ROBOT-LAYER (mock режим без реального API) ===

import pool from "../../db.js";
import {
  acquireExecutionLock,
  releaseExecutionLock,
} from "../jobs/executionLock.js";
import {
  tryStartTaskRun,
  finishTaskRun,
  getTaskRunAttempts,
  markTaskRunFailed,
} from "../db/taskRunsRepo.js";
import {
  getRetryPolicy,
  computeBackoffDelayMs,
  shouldRetry,
} from "../jobs/retryPolicy.js";

const TICK_MS = 30_000; // тик каждые 30 секунд

export async function getActiveRobotTasks() {
  const res = await pool.query(`
    SELECT *
    FROM tasks
    WHERE status = 'active'
      AND (type = 'price_monitor' OR type = 'news_monitor')
  `);
  return res.rows;
}

const mockPriceState = new Map();

export function getInitialMockPrice(symbolRaw) {
  const symbol = (symbolRaw || "BTCUSDT").toUpperCase();

  let base = 50000;
  if (symbol.includes("BTC")) base = 50000;
  else if (symbol.includes("ETH")) base = 3000;
  else if (symbol.includes("SOL")) base = 150;
  else if (symbol.includes("XRP")) base = 0.6;

  return base;
}

async function resolveChatIdByGlobalUserId(globalUserId) {
  if (!globalUserId) return null;

  try {
    const res = await pool.query(
      `
      SELECT chat_id
      FROM users
      WHERE global_user_id = $1
      LIMIT 1
      `,
      [globalUserId]
    );

    return res.rows?.[0]?.chat_id || null;
  } catch (e) {
    console.error("❌ ROBOT resolveChatId error:", e);
    return null;
  }
}

async function handlePriceMonitorTask(bot, task) {
  const payload = task.payload || {};
  const symbol = payload.symbol || "BTCUSDT";

  const intervalMinutes =
    typeof payload.interval_minutes === "number"
      ? payload.interval_minutes
      : 60;

  const thresholdPercent =
    typeof payload.threshold_percent === "number"
      ? payload.threshold_percent
      : 2;

  const now = Date.now();
  let state = mockPriceState.get(task.id);

  if (!state) {
    const initialPrice = getInitialMockPrice(symbol);
    state = { price: initialPrice, lastCheck: now };
    mockPriceState.set(task.id, state);
    return;
  }

  const msSinceLast = now - state.lastCheck;
  const intervalMs = intervalMinutes * 60_000;

  if (msSinceLast < intervalMs) {
    return;
  }

  const windowId = Math.floor(now / intervalMs);
  const runKey = `price_monitor:${String(task.id)}@${String(windowId)}`;

  const gate = await tryStartTaskRun({
    taskId: task.id,
    runKey,
    meta: {
      runner: "robotMock",
      type: "price_monitor",
      interval_minutes: intervalMinutes,
    },
  });

  if (!gate.started) {
    return;
  }

  try {
    const randomDelta = (Math.random() - 0.5) * 0.08;
    const newPrice = Math.max(1, state.price * (1 + randomDelta));
    const changePercent = ((newPrice - state.price) / state.price) * 100;

    state.price = newPrice;
    state.lastCheck = now;

    if (Math.abs(changePercent) >= thresholdPercent) {
      const direction = changePercent > 0 ? "вверх" : "вниз";

      const text =
        `⚠️ Mock-сигнал по задаче #${task.id} (${symbol}).\n` +
        `Изменение: ${changePercent.toFixed(2)}%.\n` +
        `Цена: ${newPrice.toFixed(2)}\n` +
        `Направление: ${direction}.`;

      const globalUserId = task.user_global_id;
      const userChatId = await resolveChatIdByGlobalUserId(globalUserId);

      if (userChatId && bot) {
        await bot.sendMessage(Number(userChatId), text);
      }
    }

    await finishTaskRun({
      taskId: task.id,
      runKey,
      status: "completed",
    });
  } catch (err) {
    console.error("❌ ROBOT task error:", err);

    try {
      const policy = getRetryPolicy();
      const attempts =
        (await getTaskRunAttempts({ taskId: task.id, runKey })) ?? 1;

      const failReason = String(err?.message || err || "unknown_error").slice(
        0,
        800
      );
      const failCode = String(err?.code || err?.name || "error");

      let retryAtIso = null;
      if (shouldRetry(attempts, policy)) {
        const delayMs = computeBackoffDelayMs(attempts, policy);
        retryAtIso = new Date(Date.now() + delayMs).toISOString();
      }

      await markTaskRunFailed({
        taskId: task.id,
        runKey,
        failReason,
        failCode,
        retryAtIso,
        maxRetries: policy.maxRetries,
      });
    } catch (e2) {
      await finishTaskRun({
        taskId: task.id,
        runKey,
        status: "failed",
      });
    }
  }
}

export async function robotTick(bot) {
  const locked = await acquireExecutionLock();
  if (!locked) return;

  try {
    const tasks = await getActiveRobotTasks();
    if (!tasks.length) return;

    for (const t of tasks) {
      try {
        if (t.type === "price_monitor") {
          await handlePriceMonitorTask(bot, t);
        }
      } catch (taskErr) {
        console.error("❌ ROBOT task loop error:", t.id, taskErr);
      }
    }
  } catch (err) {
    console.error("❌ ROBOT ERROR:", err);
  } finally {
    await releaseExecutionLock();
  }
}

export function startRobotLoop(bot) {
  robotTick(bot).catch(console.error);

  setInterval(() => {
    robotTick(bot).catch(console.error);
  }, TICK_MS);
}
