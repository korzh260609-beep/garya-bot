// robot/robotMock.js
// === ROBOT-LAYER (mock режим без реального API) ===

import pool from "../../db.js";

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

// Главный "тик" робота
export async function robotTick(bot) {
  try {
    const tasks = await getActiveRobotTasks();

    for (const t of tasks) {
      let p = {};
      let payloadInfo = "";
      try {
        p = t.payload || {};
        if (t.type === "price_monitor") {
          payloadInfo = `symbol=${p.symbol || "?"}, interval=${
            p.interval_minutes || "?"
          }m, threshold=${p.threshold_percent || "?"}%`;
        } else if (t.type === "news_monitor") {
          payloadInfo = `source=${p.source || "?"}, topic=${p.topic || "?"}`;
        }
      } catch (e) {
        console.error("❌ ROBOT: error reading payload for task", t.id, e);
      }

      console.log(
        "🤖 ROBOT: нашёл задачу:",
        t.id,
        t.type,
        "schedule:",
        t.schedule,
        payloadInfo ? `| payload: ${payloadInfo}` : ""
      );

      // Пока реализуем только price_monitor
      if (t.type !== "price_monitor") continue;

      const symbol = p.symbol || "BTCUSDT";
      const intervalMinutes =
        typeof p.interval_minutes === "number" ? p.interval_minutes : 60;
      const thresholdPercent =
        typeof p.threshold_percent === "number" ? p.threshold_percent : 2;

      const now = Date.now();
      let state = mockPriceState.get(t.id);

      // Первая инициализация mock-цены
      if (!state) {
        const initialPrice = getInitialMockPrice(symbol);
        state = { price: initialPrice, lastCheck: now };
        mockPriceState.set(t.id, state);

        console.log(
          "🤖 ROBOT: init mock-price for task",
          t.id,
          "symbol:",
          symbol,
          "price:",
          state.price
        );
        continue;
      }

      // Проверяем, прошёл ли нужный интервал
      const msSinceLast = now - state.lastCheck;
      if (msSinceLast < intervalMinutes * 60_000) {
        // Рано, ждём следующего тика
        continue;
      }

      // Делаем случайное изменение mock-цены (±4%)
      const randomDelta = (Math.random() - 0.5) * 0.08; // -4%..+4%
      const newPrice = Math.max(1, state.price * (1 + randomDelta));
      const changePercent = ((newPrice - state.price) / state.price) * 100;

      console.log(
        "📈 ROBOT mock-price:",
        "task",
        t.id,
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
          t.id,
          "symbol",
          symbol,
          "change=" + changePercent.toFixed(2) + "%",
          "threshold=" + thresholdPercent + "%"
        );

        const direction = changePercent > 0 ? "вверх" : "вниз";

        const text =
          `⚠️ Mock-сигнал по задаче #${t.id} (${symbol}).\n` +
          `Изменение mock-цены между двумя проверками: ${changePercent.toFixed(
            2
          )}%.\n` +
          `Текущая mock-цена: ${newPrice.toFixed(2)}\n` +
          `Направление: ${direction}.\n` +
          `Это ТЕСТОВЫЙ режим без реального биржевого API.`;

        const userChatId = t.user_chat_id;
        if (userChatId && bot) {
          try {
            await bot.sendMessage(userChatId, text);
          } catch (e) {
            console.error(
              "❌ ROBOT: не удалось отправить mock-сигнал по задаче",
              t.id,
              e
            );
          }
        }
      }
    }
  } catch (err) {
    console.error("❌ ROBOT ERROR:", err);
  }
}

// начальная mock-цена по символу
export function getInitialMockPrice(symbolRaw) {
  const symbol = (symbolRaw || "BTCUSDT").toUpperCase();

  let base = 50000;
  if (symbol.includes("BTC")) base = 50000;
  if (symbol.includes("ETH")) base = 3000;
  else if (symbol.includes("SOL")) base = 150;
  else if (symbol.includes("XRP")) base = 0.6;

  return base;
}

// ⚠️ ВАЖНО:
// Здесь мы НЕ запускаем setInterval, чтобы модуль можно было переиспользовать.
// В index.js пока остаётся оригинальный setInterval(robotTick, 30_000).
// Позже, когда будем реально переносить, можно будет сделать:
// import { robotTick } from "./robot/robotMock.js";
// setInterval(() => robotTick(bot), 30_000);

