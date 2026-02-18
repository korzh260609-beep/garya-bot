// src/robot/robotMock.js
// === ROBOT-LAYER (mock режим без реального API) ===

import pool from "../../db.js";
import { acquireExecutionLock, releaseExecutionLock } from "../jobs/executionLock.js";
import { tryStartTaskRun } from "../db/taskRunsRepo.js";

const TICK_MS = 30_000; // тик каждые 30 секунд

// Получает активные задачи с расписанием
export async function getActiveRobotTasks() {
  const res = await pool.query(`
    SELECT *
    FROM tasks
    WHERE status = 'active'
      AND schedule IS NOT NULL
      AND (type = 'price_monitor' OR type = 'news_monitor')
  `);
  return res.rows;
}

// Память mock-цен: taskId -> { price, lastCheck }
const mockPriceState = new Map();

// начальная mock-цена по символу
export function getInitialMockPrice(symbolRaw) {
  const symbol = (symbolRaw || "BTCUSDT").toUpperCase();

  let base = 50000;
  if (symbol.includes("BTC")) base = 50000;
  else if (symbol.includes("ETH")) base = 3000;
  else if (symbol.includes("SOL")) base = 150;
  else if (symbol.includes("XRP")) base = 0.6;

  return base;
}

// === identity-first: resolve chat_id by global_user_id ===
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

// Обработка одной задачи типа price_monitor (mock)
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

  // Первая инициализация mock-цены
  if (!state) {
    const initialPrice = getInitialMockPrice(symbol);
    state = { price: initialPrice, lastCheck: now };
    mockPriceState.set(task.id, state);

    console.log(
      "🤖 ROBOT: init mock-price for task",
      task.id,
      "symbol:",
      symbol,
      "price:",
      state.price
    );
    return;
  }

  // Проверяем, прошёл ли нужный интервал
  const msSinceLast = now - state.lastCheck;
  const intervalMs = intervalMinutes * 60_000;

  if (msSinceLast < intervalMs) {
    return;
  }

  // =======================================
  // Stage 2.8 — Runtime Dedup Gate (task_runs)
  // =======================================
  // 1 run per task per interval-window (e.g. 60m), not per 30s tick
  const windowId = Math.floor(now / intervalMs);
  const runKey = `price_monitor:${String(task.id)}@${String(windowId)}`;

  const gate = await tryStartTaskRun({
    taskId: task.id,
    runKey,
    meta: { runner: "robotMock", type: "price_monitor", interval_minutes: intervalMinutes },
  });

  // already started elsewhere → skip
  if (!gate.started) {
    return;
  }

  // Делаем случайное изменение mock-цены (±4%)
  const randomDelta = (Math.random() - 0.5) * 0.08; // -4%..+4%
  const newPrice = Math.max(1, state.price * (1 + randomDelta));
  const changePercent = ((newPrice - state.price) / state.price) * 100;

  console.log(
    "📈 ROBOT mock-price:",
    "task",
    task.id,
    "symbol",
    symbol,
    "old=" + state.price.toFixed(2),
    "new=" + newPrice.toFixed(2),
    "Δ=" + changePercent.toFixed(2) + "%",
    "interval=" + intervalMinutes + "m"
  );

  // обновляем состояние
  state.price = newPrice;
  state.lastCheck = now;

  // если изменение больше порога — шлём mock-сигнал
  if (Math.abs(changePercent) >= thresholdPercent) {
    console.log(
      "🔥 MOCK alert for task",
      task.id,
      "symbol",
      symbol,
      "change=" + changePercent.toFixed(2) + "%",
      "threshold=" + thresholdPercent + "%"
    );

    const direction = changePercent > 0 ? "вверх" : "вниз";

    const text =
      `⚠️ Mock-сигнал по задаче #${task.id} (${symbol}).\n` +
      `Изменение mock-цены между двумя проверками: ${changePercent.toFixed(2)}%.\n` +
      `Текущая mock-цена: ${newPrice.toFixed(2)}\n` +
      `Направление: ${direction}.\n` +
      `Это ТЕСТОВЫЙ режим без реального биржевого API.`;

    // === identity-first отправка ===
    const globalUserId = task.user_global_id;
    const userChatId = await resolveChatIdByGlobalUserId(globalUserId);

    if (userChatId && bot) {
      try {
        await bot.sendMessage(Number(userChatId), text);
      } catch (e) {
        console.error(
          "❌ ROBOT: не удалось отправить mock-сигнал по задаче",
          task.id,
          e
        );
      }
    }
  }
}

// Главный "тик" робота
export async function robotTick(bot) {
  const locked = await acquireExecutionLock();
  if (!locked) {
    return;
  }

  try {
    const tasks = await getActiveRobotTasks();

    if (!tasks.length) {
      return;
    }

    for (const t of tasks) {
      try {
        if (t.type === "price_monitor") {
          await handlePriceMonitorTask(bot, t);
        } else if (t.type === "news_monitor") {
          // future
        }
      } catch (taskErr) {
        console.error("❌ ROBOT: ошибка обработки задачи", t.id, taskErr);
      }
    }
  } catch (err) {
    console.error("❌ ROBOT ERROR:", err);
  } finally {
    await releaseExecutionLock();
  }
}

// Старт цикла робота
export function startRobotLoop(bot) {
  console.log(
    `🤖 ROBOT: старт mock-цикла (tick каждые ${TICK_MS / 1000} секунд)`
  );

  robotTick(bot).catch((err) =>
    console.error("❌ ROBOT: ошибка первого mock-tick:", err)
  );

  setInterval(() => {
    robotTick(bot).catch((err) =>
      console.error("❌ ROBOT: ошибка в mock-tick:", err)
    );
  }, TICK_MS);
}
