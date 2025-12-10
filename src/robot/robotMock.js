// src/robot/robotMock.js
// === ROBOT-LAYER (mock режим без реального API) ===

import pool from "../../db.js";

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
  if (msSinceLast < intervalMinutes * 60_000) {
    // Интервал ещё не прошёл — ничего не делаем и не спамим лог
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
      `Изменение mock-цены между двумя проверками: ${changePercent.toFixed(
        2
      )}%.\n` +
      `Текущая mock-цена: ${newPrice.toFixed(2)}\n` +
      `Направление: ${direction}.\n` +
      `Это ТЕСТОВЫЙ режим без реального биржевого API.`;

    const userChatId = task.user_chat_id;
    if (userChatId && bot) {
      try {
        await bot.sendMessage(userChatId, text);
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
  try {
    const tasks = await getActiveRobotTasks();

    if (!tasks.length) {
      // Нет активных задач — тихо выходим
      return;
    }

    for (const t of tasks) {
      try {
        if (t.type === "price_monitor") {
          await handlePriceMonitorTask(bot, t);
        } else if (t.type === "news_monitor") {
          // Пока заглушка — в будущем тут будет mock/реальный news монитор
          // Можно оставить лёгкий лог, если нужно отладить:
          // console.log("📰 ROBOT: пропускаем news_monitor (mock-заглушка)", t.id);
        }
      } catch (taskErr) {
        console.error("❌ ROBOT: ошибка обработки задачи", t.id, taskErr);
      }
    }
  } catch (err) {
    console.error("❌ ROBOT ERROR:", err);
  }
}

// Старт цикла робота (обёртка для index.js)
export function startRobotLoop(bot) {
  console.log(
    `🤖 ROBOT: старт mock-цикла (tick каждые ${TICK_MS / 1000} секунд)`
  );

  // делаем первый тик сразу
  robotTick(bot).catch((err) =>
    console.error("❌ ROBOT: ошибка первого mock-tick:", err)
  );

  setInterval(() => {
    robotTick(bot).catch((err) =>
      console.error("❌ ROBOT: ошибка в mock-tick:", err)
    );
  }, TICK_MS);
}

// ⚠️ ВАЖНО:
// index.js использует так:
// import { startRobotLoop } from "./src/robot/robotMock.js";
// ...
// startRobotLoop(bot);
