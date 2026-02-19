// src/robot/robotMock.js

import pool from "../db.js";

const TICK_MS = 30_000; // тик каждые 30 секунд

export async function getActiveRobotTasks() {
  // ✅ Строго: робот видит ТОЛЬКО active задачи нужных типов
  const res = await pool.query(`
    SELECT id, status, type, schedule, payload, user_global_id
    FROM tasks
    WHERE status = 'active'
      AND type IN ('price_monitor', 'news_monitor')
  `);

  // ✅ Логи только по флагу, иначе LOG SPAM
  if (String(process.env.ROBOT_DEBUG || "").toLowerCase() === "true") {
    console.log("🤖 ROBOT ACTIVE TASKS:", res.rows);
  }

  return res.rows || [];
}

function safeJsonParse(v, fallback = {}) {
  try {
    if (v == null) return fallback;
    if (typeof v === "object") return v;
    return JSON.parse(v);
  } catch {
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

  // optional forced fail (для тестов)
  if (payload.force_fail === true) {
    throw new Error("TEST_FAIL: forced by payload.force_fail");
  }

  const randomDelta = (Math.random() - 0.5) * 0.08; // ~ +/-4%
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

    const userChatId = await resolveChatIdByGlobalUserId(task.user_global_id);
    if (userChatId && bot) {
      await bot.sendMessage(Number(userChatId), text);
    }
  }
}

export async function robotTick(bot) {
  try {
    const tasks = await getActiveRobotTasks();
    if (!tasks.length) return;

    for (const t of tasks) {
      try {
        if (t.type === "price_monitor") {
          await handlePriceMonitorTask(bot, t);
        }
        // news_monitor можно добавить позже
      } catch (taskErr) {
        // ⚠️ Ошибка по конкретной задаче — логируем коротко (без массивов)
        console.error("❌ ROBOT task loop error:", t.id, taskErr?.message || taskErr);
      }
    }
  } catch (err) {
    console.error("❌ ROBOT ERROR:", err?.message || err);
  }
}

export function startRobotLoop(bot) {
  robotTick(bot).catch((e) => console.error("❌ ROBOT first tick error:", e));

  setInterval(() => {
    robotTick(bot).catch((e) => console.error("❌ ROBOT tick error:", e));
  }, TICK_MS);
}
