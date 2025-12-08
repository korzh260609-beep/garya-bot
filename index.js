// === Импорты ===
import TelegramBot from "node-telegram-bot-api";
import express from "express";
import pool from "./db.js"; // память + профили + tasks
import * as Sources from "./sources.js"; // скелет слоя источников
import { classifyInteraction } from "./classifier.js"; // скелет классификатора
import { callAI } from "./ai.js"; // универсальный вызов ИИ
import { buildSystemPrompt } from "./systemPrompt.js";
import { getProjectSection, upsertProjectSection } from "./projectMemory.js";

// === Константы ===
const MAX_HISTORY_MESSAGES = 20;

// === РЕЖИМЫ ОТВЕТОВ (answer_mode) ===
const DEFAULT_ANSWER_MODE = "short"; // по ТЗ экономим токены по умолчанию
// В будущем это уйдёт в БД, сейчас — простая карта в памяти процесса
const answerModeByChat = new Map(); // chatId (строка) -> "short" | "normal" | "long"

function getAnswerMode(chatIdStr) {
  return answerModeByChat.get(chatIdStr) || DEFAULT_ANSWER_MODE;
}

function setAnswerMode(chatIdStr, mode) {
  answerModeByChat.set(chatIdStr, mode);
}

// === PROJECT MEMORY HELPERS (3A) ===
async function loadProjectContext() {
  try {
    const roadmap = await getProjectSection(undefined, "roadmap");
    const workflow = await getProjectSection(undefined, "workflow");

    const parts = [];

    if (roadmap?.content) {
      parts.push(`ROADMAP:\n${roadmap.content}`);
    }

    if (workflow?.content) {
      parts.push(`WORKFLOW:\n${workflow.content}`);
    }

    if (parts.length === 0) {
      return "";
    }

    const fullText = parts.join("\n\n");
    // ограничиваем длину, чтобы не раздуть системный промпт
    return fullText.slice(0, 4000);
  } catch (err) {
    console.error("❌ loadProjectContext error:", err);
    return "";
  }
}

// === Express сервер ===
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// === Telegram Bot ===
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN is missing!");
  console.error(
    "Убедись, что переменная окружения TELEGRAM_BOT_TOKEN задана в окружении сервера."
  );
  process.exit(1);
}

const bot = new TelegramBot(token);

// === Telegram Webhook ===
const WEBHOOK_URL = `https://garya-bot.onrender.com/webhook/${token}`;
bot.setWebHook(WEBHOOK_URL);

app.get("/", (req, res) => {
  res.send("GARYA AI Bot is alive! ⚡");
});

app.post(`/webhook/${token}`, (req, res) => {
  res.sendStatus(200);
  console.log("📩 Incoming webhook update:", JSON.stringify(req.body));
  try {
    bot.processUpdate(req.body);
  } catch (err) {
    console.error("❌ Error in bot.processUpdate:", err);
  }
});

app.get(`/webhook/${token}`, (req, res) => {
  console.log("🔎 GET webhook ping");
  res.send("OK");
});

app.listen(PORT, () => {
  console.log("🌐 Web server started on port:", PORT);

  // === Инициализация реестра источников (Sources Layer) ===
  Sources.ensureDefaultSources()
    .then(() => {
      console.log("📡 Sources: default templates are ready.");
    })
    .catch((err) => {
      console.error("❌ Error initializing sources registry:", err);
    });
});

// === ФУНКЦИИ ДЛЯ ПАМЯТИ ===
async function getChatHistory(chatId, limit = MAX_HISTORY_MESSAGES) {
  try {
    const result = await pool.query(
      `
        SELECT role, content
        FROM chat_memory
        WHERE chat_id = $1
        ORDER BY id DESC
        LIMIT $2
      `,
      [chatId, limit]
    );
    // в БД новые сверху, в ИИ — от старых к новым
    return result.rows.reverse().map((row) => ({
      role: row.role,
      content: row.content,
    }));
  } catch (err) {
    console.error("❌ getChatHistory DB error:", err);
    return [];
  }
}

// авто-очистка: оставляем только последние MAX_HISTORY_MESSAGES записей
// ⚠️ ВНИМАНИЕ: в ЭТАПЕ 3.6 мы её больше НЕ вызываем, чтобы накапливать долговременную память.
// Функцию оставляем на будущее (для резюмирования/архивирования).
async function cleanupChatHistory(chatId, maxMessages = MAX_HISTORY_MESSAGES) {
  try {
    const res = await pool.query(
      `
        SELECT id
        FROM chat_memory
        WHERE chat_id = $1
        ORDER BY id DESC
        OFFSET $2
      `,
      [chatId, maxMessages]
    );

    if (res.rows.length === 0) return;

    const idsToDelete = res.rows.map((r) => r.id);

    await pool.query(
      `
        DELETE FROM chat_memory
        WHERE id = ANY($1::int[])
      `,
      [idsToDelete]
    );

    console.log(
      `🧹 cleanupChatHistory: удалено ${idsToDelete.length} старых записей для чата ${chatId}`
    );
  } catch (err) {
    console.error("❌ cleanupChatHistory DB error:", err);
  }
}

// Сохраняем одно сообщение в память с защитой от дублей подряд (ЭТАП 3.6)
async function saveMessageToMemory(chatId, role, content) {
  if (!content || !content.trim()) return;

  try {
    // Берём последнее сообщение в этом чате
    const lastRes = await pool.query(
      `
        SELECT role, content
        FROM chat_memory
        WHERE chat_id = $1
        ORDER BY id DESC
        LIMIT 1
      `,
      [chatId]
    );

    const last = lastRes.rows[0];
    if (last && last.role === role && last.content === content) {
      // Точно такой же текст уже последним — дубль не записываем
      return;
    }

    await pool.query(
      `
        INSERT INTO chat_memory (chat_id, role, content)
        VALUES ($1, $2, $3)
      `,
      [chatId, role, content]
    );
  } catch (err) {
    console.error("❌ saveMessageToMemory DB error:", err);
  }
}

async function saveChatPair(chatId, userText, assistantText) {
  try {
    // Сначала пользователь, потом ассистент — аккуратная история диалога
    await saveMessageToMemory(chatId, "user", userText);
    await saveMessageToMemory(chatId, "assistant", assistantText);

    // ВАЖНО: больше не чистим историю. Долговременная память накапливается.
    // await cleanupChatHistory(chatId, MAX_HISTORY_MESSAGES);
  } catch (err) {
    console.error("❌ saveChatPair DB error:", err);
  }
}

// === USER PROFILE HANDLING ===
async function ensureUserProfile(msg) {
  const chatId = msg.chat.id.toString();
  const nameFromTelegram = msg.from?.first_name || null;

  let role = "guest";
  let finalName = nameFromTelegram;

  // монарх
  if (chatId === "677128443") {
    role = "monarch";
    finalName = "GARY";
  }

  try {
    const existing = await pool.query(
      "SELECT * FROM users WHERE chat_id = $1",
      [chatId]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `
          INSERT INTO users (chat_id, name, role, language)
          VALUES ($1, $2, $3, $4)
        `,
        [chatId, finalName, role, msg.from?.language_code || null]
      );

      console.log(`👤 Новый пользователь: ${finalName} (${role})`);
    } else {
      const user = existing.rows[0];
      if (user.name !== finalName) {
        await pool.query("UPDATE users SET name = $1 WHERE chat_id = $2", [
          finalName,
          chatId,
        ]);
      }
    }
  } catch (err) {
    console.error("❌ Error in ensureUserProfile:", err);
  }
}

// === ФУНКЦИИ ДЛЯ TASK ENGINE ===

// демо-задача
async function createDemoTask(userChatId) {
  const payload = {
    note: "Это демо-задача. В будущем здесь будут параметры отчёта/мониторинга.",
  };

  const result = await pool.query(
    `
      INSERT INTO tasks (user_chat_id, title, type, payload, schedule, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [
      userChatId,
      "Demo task: hello from Task Engine",
      "demo",
      payload,
      null,
      "active",
    ]
  );

  return result.rows[0].id;
}

// обычная ручная задача из /newtask
async function createManualTask(userChatId, promptText) {
  let title = promptText.trim();
  if (title.length > 60) {
    title = title.slice(0, 57) + "...";
  }

  const payload = {
    prompt: promptText.trim(),
  };

  const result = await pool.query(
    `
      INSERT INTO tasks (user_chat_id, title, type, payload, schedule, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `,
    [userChatId, title, "manual", payload, null, "active"]
  );

  return result.rows[0];
}

// создаём тестовую задачу price_monitor для BTC (для проверки ROBOT-слоя)
async function createTestPriceMonitorTask(userChatId) {
  const payload = {
    symbol: "BTCUSDT",
    interval_minutes: 60,
    threshold_percent: 2,
  };

  const result = await pool.query(
    `
      INSERT INTO tasks (user_chat_id, title, type, payload, schedule, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `,
    [
      userChatId,
      "BTC monitor test (раз в час)",
      "price_monitor",
      payload,
      "0 * * * *", // каждый час
      "active",
    ]
  );

  return result.rows[0];
}

// получаем последние задачи пользователя
async function getUserTasks(userChatId, limit = 10) {
  const result = await pool.query(
    `
      SELECT id, title, type, status, schedule, last_run, created_at
      FROM tasks
      WHERE user_chat_id = $1
      ORDER BY id DESC
      LIMIT $2
    `,
    [userChatId, limit]
  );
  return result.rows;
}

// получаем задачу по id для конкретного пользователя
async function getTaskById(userChatId, taskId) {
  const result = await pool.query(
    `
      SELECT id, user_chat_id, title, type, status, payload, schedule, last_run, created_at
      FROM tasks
      WHERE user_chat_id = $1 AND id = $2
      LIMIT 1
    `,
    [userChatId, taskId]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

// ОБНОВЛЯЕМ СТАТУС ЗАДАЧИ (pause/resume/delete)
async function updateTaskStatus(userChatId, taskId, newStatus) {
  await pool.query(
    `
      UPDATE tasks
      SET status = $1
      WHERE user_chat_id = $2 AND id = $3
    `,
    [newStatus, userChatId, taskId]
  );
}

// запуск задачи через ИИ-исполнителя
async function runTaskWithAI(task, chatId) {
  if (!process.env.OPENAI_API_KEY) {
    await bot.sendMessage(
      chatId,
      "Задача есть, но ИИ сейчас недоступен (нет API ключа)."
    );
    return;
  }

  const promptText =
    (task.payload && (task.payload.prompt || task.payload.note)) ||
    task.title ||
    "";

  const messages = [
    {
      role: "system",
      content: `
Ты — модуль Task Engine Королевства GARYA.
Тебе дают ЗАДАЧУ, сформулированную обычными словами.
Твоя цель — максимально буквально и полезно ВЫПОЛНИТЬ её в пределах своих возможностей:
— думать, анализировать, считать, планировать;
— давать чёткий результат, пошаговый план или расчёты;
— писать всё по-русски, кратко и по делу.

Если задача требует реальных действий во внешнем мире (доступ к бирже, TradingView, интернету, API),
которых у тебя нет, НЕ ПРИТВОРЯЙСЯ, что у тебя есть эти данные.
Вместо этого:
— объясни, что ты можешь сделать только аналитически;
— выдай максимальный полезный план: как бы ты выполнял эту задачу, какие шаги, формулы, правила.
      `,
    },
    {
      role: "user",
      content: `Задача #${task.id} (${task.type}, статус: ${task.status}).
Текст задачи (payload.prompt/title):
"${promptText}"`,
    },
  ];

  // === Вызов ИИ через единый слой ai.js ===
  let reply = "";
  try {
    reply = await callAI(messages, "high");
  } catch (e) {
    console.error("❌ AI error:", e);
    reply = "⚠️ ИИ временно недоступен — произошла ошибка при вызове модели.";
  }

  await pool.query("UPDATE tasks SET last_run = NOW() WHERE id = $1", [
    task.id,
  ]);

  await bot.sendMessage(
    chatId,
    `🚀 Задача #${task.id} выполнена ИИ-движком.\n\n${reply}`
  );
}

// === SOURCES DEBUG FUNCTIONS ===

// выводим список всех источников (даже disabled)
async function getAllSourcesSafe() {
  try {
    const result = await pool.query(
      `
        SELECT key, name, type, enabled, url, config
        FROM sources
        ORDER BY key
      `
    );
    return result.rows;
  } catch (err) {
    console.error("❌ getAllSourcesSafe error:", err);
    return [];
  }
}

function formatSourcesList(sources) {
  if (!sources || sources.length === 0) {
    return "Источники не найдены.";
  }

  return sources
    .map((src) => {
      return `
🔹 <b>${src.name}</b>
key: <code>${src.key}</code>
type: <code>${src.type}</code>
enabled: ${src.enabled ? "🟢" : "🔴"}
      `.trim();
    })
    .join("\n\n");
}

// === ROBOT MOCK-LAYER ===

// получаем активные задачи
async function getActiveRobotTasks() {
  const res = await pool.query(`
    SELECT *
    FROM tasks
    WHERE status = 'active'
      AND schedule IS NOT NULL
      AND (type = 'price_monitor' OR type = 'news_monitor')
  `);
  return res.rows;
}

// mock-память цен
const mockPriceState = new Map();

// тик робота
async function robotTick() {
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

      if (t.type !== "price_monitor") continue;

      const symbol = p.symbol || "BTCUSDT";
      const intervalMinutes =
        typeof p.interval_minutes === "number" ? p.interval_minutes : 60;
      const thresholdPercent =
        typeof p.threshold_percent === "number" ? p.threshold_percent : 2;

      const now = Date.now();
      let state = mockPriceState.get(t.id);

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

      const msSinceLast = now - state.lastCheck;
      if (msSinceLast < intervalMinutes * 60000) continue;

      const randomDelta = (Math.random() - 0.5) * 0.08;
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

      state.price = newPrice;
      state.lastCheck = now;

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
          `Это ТЕСТОВЫЙ режим — без настоящих биржевых данных.`;

        const userChatId = t.user_chat_id;
        if (userChatId) {
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

function getInitialMockPrice(symbolRaw) {
  const symbol = (symbolRaw || "BTCUSDT").toUpperCase();

  let base = 50000;
  if (symbol.includes("BTC")) base = 50000;
  if (symbol.includes("ETH")) base = 3000;
  else if (symbol.includes("SOL")) base = 150;
  else if (symbol.includes("XRP")) base = 0.6;

  return base;
}

// запускаем робота каждые 30 секунд
setInterval(robotTick, 30_000);

// === ОБРАБОТКА СООБЩЕНИЙ ===
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = chatId.toString();

  // загрузка или обновление профиля пользователя
  await ensureUserProfile(msg);

  const text = msg.text || "";
  const trimmed = text.trim();

  // === ОБРАБОТКА ВЛОЖЕНИЙ (фото, документы, голосовые) ===
  let mediaSummary = "";
  if (msg.photo && msg.photo.length > 0) {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    mediaSummary += `📷 Фото (file_id=${fileId})`;
  }
  if (msg.document) {
    mediaSummary += (mediaSummary ? "; " : "") + `📄 Документ (${msg.document.file_name || "без имени"})`;
  }
  if (msg.voice) {
    mediaSummary += (mediaSummary ? "; " : "") + `🎤 Голосовое сообщение (duration=${msg.voice.duration}s)`;
  }
  if (msg.video) {
    mediaSummary += (mediaSummary ? "; " : "") + `🎬 Видео (duration=${msg.video.duration || "?"}s)`;
  }

  // 1) Команды, начинающиеся с "/"
  if (trimmed.startsWith("/")) {
    const parts = trimmed.split(" ");
    const cmd = parts[0];
    const args = parts.slice(1).join(" ");

    switch (cmd) {
      case "/profile":
      case "/whoami":
      case "/me": {
        try {
          const res = await pool.query(
            "SELECT chat_id, name, role, language, created_at FROM users WHERE chat_id = $1",
            [chatIdStr]
          );

          if (res.rows.length === 0) {
            await bot.sendMessage(
              chatId,
              "Пока что у меня нет данных о вашем профиле в системе."
            );
          } else {
            const u = res.rows[0];
            const text =
              `🧾 Профиль пользователя\n` +
              `ID чата: \`${u.chat_id}\`\n` +
              `Имя: ${u.name || "—"}\n` +
              `Роль: ${u.role || "—"}\n` +
              `Язык: ${u.language || "—"}\n` +
              `Создан: ${u.created_at?.toISOString?.() || "—"}`;

            await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
          }
        } catch (e) {
          console.error("❌ Error in /profile:", e);
          await bot.sendMessage(
            chatId,
            "Не удалось прочитать профиль пользователя."
          );
        }
        return;
      }

      case "/demo_task": {
        try {
          const id = await createDemoTask(chatIdStr);
          await bot.sendMessage(
            chatId,
            `✅ Демо-задача создана! ID: ${id}\n` +
              "Пока что это просто запись в таблице tasks. В будущем сюда прикрутим реальные отчёты/мониторинг."
          );
        } catch (e) {
          console.error("❌ Error in /demo_task:", e);
          await bot.sendMessage(
            chatId,
            "Не удалось создать демо-задачу. См. логи сервера."
          );
        }
        return;
      }

      case "/btc_test_task": {
        try {
          const task = await createTestPriceMonitorTask(chatIdStr);
          await bot.sendMessage(
            chatId,
            `🆕 Тестовая задача мониторинга BTC создана!\n\n` +
              `#${task.id} — price_monitor\n` +
              `Статус: active\n` +
              `Описание: BTC monitor test (раз в час)\n` +
              `Расписание: 0 * * * *\n`
          );
        } catch (e) {
          console.error("❌ Error in /btc_test_task:", e);
          await bot.sendMessage(
            chatId,
            "Не удалось создать тестовую задачу мониторинга BTC."
          );
        }
        return;
      }

      case "/newtask": {
        const taskText = args.trim();
        if (!taskText) {
          await bot.sendMessage(
            chatId,
            "Нужно указать описание задачи.\n\nПример:\n`/newtask кратко опиши, что делать`",
            { parse_mode: "Markdown" }
          );
          return;
        }

        try {
          const task = await createManualTask(chatIdStr, taskText);
          await bot.sendMessage(
            chatId,
            `🆕 Задача создана!\n\n` +
              `#${task.id} — manual\n` +
              `Статус: active\n` +
              `Описание: ${taskText}\n` +
              `Создана: ${task.created_at?.toISOString?.() || "—"}`
          );
        } catch (e) {
          console.error("❌ Error in /newtask:", e);
          await bot.sendMessage(
            chatId,
            "Не удалось создать задачу в Task Engine."
          );
        }

        return;
      }

      case "/run": {
        const id = Number(args.trim());
        if (!id) {
          await bot.sendMessage(
            chatId,
            "Нужно указать ID задачи. Пример: `/run 10`",
            { parse_mode: "Markdown" }
          );
          return;
        }

        try {
          const task = await getTaskById(chatIdStr, id);
          if (!task) {
            await bot.sendMessage(
              chatId,
              `Я не нашёл задачу #${id} среди ваших задач.`
            );
            return;
          }

          await bot.sendMessage(
            chatId,
            `🚀 Запускаю задачу #${task.id} через ИИ-движок...`
          );
          await runTaskWithAI(task, chatId);
        } catch (e) {
          console.error("❌ Error in /run:", e);
          await bot.sendMessage(
            chatId,
            "Не удалось запустить задачу. См. логи сервера."
          );
        }

        return;
      }

      case "/tasks": {
        try {
          const tasks = await getUserTasks(chatIdStr, 30);
          if (!tasks || tasks.length === 0) {
            await bot.sendMessage(
              chatId,
              "У вас пока нет задач в Task Engine.\n" +
                "Создайте демо-задачу командой /demo_task или задачу вручную через /newtask."
            );
            return;
          }

          let text = "📋 Ваши задачи:\n\n";
          for (const t of tasks) {
            text +=
              `#${t.id} — ${t.title}\n` +
              `Тип: ${t.type}\n` +
              `Статус: ${t.status}\n` +
              `Создана: ${t.created_at?.toISOString?.() || "—"}\n` +
              (t.schedule ? `Расписание: ${t.schedule}\n` : "") +
              (t.last_run
                ? `Последний запуск: ${t.last_run.toISOString()}\n`
                : "") +
              `\n`;
          }

          await bot.sendMessage(chatId, text);
        } catch (e) {
          console.error("❌ Error in /tasks:", e);
          await bot.sendMessage(
            chatId,
            "Не удалось получить список задач из Task Engine."
          );
        }

        return;
      }

      case "/task": {
        const raw = args.trim();
        if (!raw) {
          await bot.sendMessage(
            chatId,
            "Команда `/task` — работа с задачами Task Engine.\n\n" +
              "Варианты:\n" +
              "• `/task list`\n" +
              "• `/task new <описание>`\n" +
              "• `/task pause <id>`\n" +
              "• `/task resume <id>`\n" +
              "• `/task delete <id>`\n" +
              "• `/task <id>` — подробности\n",
            { parse_mode: "Markdown" }
          );
          return;
        }

        const subParts = raw.split(" ");
        const first = subParts[0].toLowerCase();
        const rest = subParts.slice(1).join(" ").trim();

        // /task list
        if (first === "list") {
          try {
            const tasks = await getUserTasks(chatIdStr, 50);
            if (!tasks || tasks.length === 0) {
              await bot.sendMessage(chatId, "У вас пока нет задач.");
              return;
            }

            let text = "📋 Ваши задачи:\n\n";
            for (const t of tasks) {
              text +=
                `#${t.id} — ${t.title}\n` +
                `Тип: ${t.type}\n` +
                `Статус: ${t.status}\n` +
                `Создана: ${t.created_at?.toISOString?.() || "—"}\n` +
                (t.schedule ? `Расписание: ${t.schedule}\n` : "") +
                (t.last_run
                  ? `Последний запуск: ${t.last_run.toISOString()}\n`
                  : "") +
                `\n`;
            }
            await bot.sendMessage(chatId, text);
          } catch (e) {
            console.error("❌ Error /task list:", e);
            await bot.sendMessage(chatId, "Ошибка получения списка задач.");
          }
          return;
        }

        // /task new
        if (first === "new") {
          if (!rest) {
            await bot.sendMessage(
              chatId,
              "Использование:\n`/task new <описание>`",
              { parse_mode: "Markdown" }
            );
            return;
          }

          try {
            const task = await createManualTask(chatIdStr, rest);
            await bot.sendMessage(
              chatId,
              `🆕 Задача создана!\n\n#${task.id} — manual\nОписание: ${rest}`
            );
          } catch (e) {
            console.error("❌ Error /task new:", e);
            await bot.sendMessage(chatId, "Ошибка создания задачи.");
          }
          return;
        }

        // /task pause/delete/resume
        if (["pause", "resume", "delete"].includes(first)) {
          if (!rest) {
            await bot.sendMessage(
              chatId,
              "Нужно указать ID. Пример:\n`/task pause 10`",
              { parse_mode: "Markdown" }
            );
            return;
          }

          const idVal = Number(rest);
          if (Number.isNaN(idVal)) {
            await bot.sendMessage(chatId, "ID должен быть числом.");
            return;
          }

          try {
            const task = await getTaskById(chatIdStr, idVal);
            if (!task) {
              await bot.sendMessage(chatId, `Задача #${idVal} не найдена.`);
              return;
            }

            let newStatus = task.status;
            let txt = "";

            if (first === "pause") {
              newStatus = "paused";
              txt = `⏸ Задача #${idVal} поставлена на паузу.`;
            } else if (first === "resume") {
              newStatus = "active";
              txt = `▶️ Задача #${idVal} возобновлена.`;
            } else if (first === "delete") {
              newStatus = "deleted";
              txt = `🗑 Задача #${idVal} удалена.`;
            }

            await updateTaskStatus(chatIdStr, idVal, newStatus);
            await bot.sendMessage(chatId, txt);
          } catch (e) {
            console.error("❌ Error pause/resume/delete:", e);
            await bot.sendMessage(chatId, "Ошибка изменения статуса задачи.");
          }

          return;
        }

        // /task <id> — подробности
        const idVal = Number(first);
        if (Number.isNaN(idVal)) {
          await bot.sendMessage(
            chatId,
            "Неизвестная подкоманда. Используйте list/new/pause/resume/delete/<id>."
          );
          return;
        }

        try {
          const task = await getTaskById(chatIdStr, idVal);
          if (!task) {
            await bot.sendMessage(chatId, `Задача #${idVal} не найдена.`);
            return;
          }

          const textTask =
            `🔍 Задача #${task.id}\n\n` +
            `Название: ${task.title}\n` +
            `Тип: ${task.type}\n` +
            `Статус: ${task.status}\n` +
            `Создана: ${task.created_at?.toISOString?.() || "—"}\n` +
            (task.schedule ? `Расписание: ${task.schedule}\n` : "") +
            (task.last_run
              ? `Последний запуск: ${task.last_run.toISOString()}\n`
              : "") +
            `\nЗапуск: /run ${task.id}`;

          await bot.sendMessage(chatId, textTask);
        } catch (e) {
          console.error("❌ Error reading task:", e);
          await bot.sendMessage(chatId, "Ошибка чтения задачи.");
        }

        return;
      }

      case "/meminfo": {
        try {
          const res = await pool.query(
            `
              SELECT COUNT(*)::int AS total
              FROM chat_memory
              WHERE chat_id = $1
            `,
            [chatIdStr]
          );

          const total = res.rows[0]?.total ?? 0;

          await bot.sendMessage(
            chatId,
            `📊 Память по этому чату: ${total} сообщений.`
          );
        } catch (e) {
          console.error("❌ /meminfo error:", e);
          await bot.sendMessage(chatId, "Ошибка чтения памяти.");
        }
        return;
      }

      case "/memstats": {
        try {
          const res = await pool.query(
            `
              SELECT COUNT(*)::int AS total
              FROM chat_memory
              WHERE chat_id = $1
            `,
            [chatIdStr]
          );

          const total = res.rows[0]?.total ?? 0;

          let latestBlock = "Нет записей.";
          if (total > 0) {
            const last = await pool.query(
              `
                SELECT role, content, created_at
                FROM chat_memory
                WHERE chat_id = $1
                ORDER BY id DESC
                LIMIT 1
              `,
              [chatIdStr]
            );

            const row = last.rows[0];
            if (row) {
              const snippet =
                row.content.length > 400
                  ? row.content.slice(0, 400) + "..."
                  : row.content;

              latestBlock =
                `Последняя запись:\n` +
                `🕒 ${row.created_at}\n` +
                `🎭 Роль: ${row.role}\n` +
                `💬 ${snippet}`;
            }
          }

          const textStats =
            `📊 Статус долговременной памяти\n` +
            `Всего сообщений: ${total}\n\n` +
            latestBlock;

          await bot.sendMessage(chatId, textStats);
        } catch (e) {
          console.error("❌ /memstats error:", e);
          await bot.sendMessage(chatId, "Ошибка чтения памяти.");
        }
        return;
      }

      case "/sources": {
        try {
          const sources = await getAllSourcesSafe();
          const textSources = formatSourcesList(sources);
          await bot.sendMessage(chatId, textSources, { parse_mode: "HTML" });
        } catch (e) {
          console.error("❌ Error in /sources:", e);
          await bot.sendMessage(
            chatId,
            "Не удалось получить список источников."
          );
        }

        return;
      }

      case "/sources_diag": {
        try {
          const summary = await Sources.runSourceDiagnosticsOnce();

          const lines = [];
          lines.push("🩺 Диагностика всех активных источников:");
          lines.push(`Всего: ${summary.total}`);
          lines.push(`OK: ${summary.okCount}`);
          lines.push(`С ошибками: ${summary.failCount}`);

          if (summary.failCount > 0) {
            lines.push("");
            lines.push("Проблемные:");
            for (const item of summary.items) {
              if (item.ok) continue;
              lines.push(`- ${item.key}: ${item.error || "неизвестная ошибка"}`);
            }
          }

          await bot.sendMessage(chatId, lines.join("\n"));
        } catch (e) {
          console.error("❌ Error in /sources_diag:", e);
          await bot.sendMessage(
            chatId,
            "❌ Ошибка диагностики источников. См. логи сервера."
          );
        }

        return;
      }

      case "/source": {
        const key = args.trim();
        if (!key) {
          await bot.sendMessage(
            chatId,
            "Нужно указать key источника. Например: `/source coingecko_global`",
            { parse_mode: "Markdown" }
          );
          return;
        }

        try {
          const result = await Sources.fetchFromSourceKey(key);

          if (!result.ok) {
            await bot.sendMessage(
              chatId,
              `❌ Источник "${key}" вернул ошибку.\n${result.error || ""}`
            );
            return;
          }

          const payload =
            result.data ||
            result.htmlSnippet ||
            result.xmlSnippet ||
            result.items ||
            null;

          const previewObj = {
            ok: result.ok,
            sourceKey: result.sourceKey || key,
            type: result.type || "unknown",
            payload,
          };

          const preview = JSON.stringify(previewObj, null, 2).slice(0, 900);

          const textSource =
            `✅ Источник "${previewObj.sourceKey}" отработал успешно.\n\n` +
            `Тип: ${previewObj.type}\n\n` +
            `📄 Предпросмотр (обрезано):\n` +
            preview;

          await bot.sendMessage(chatId, textSource);
        } catch (e) {
          console.error("❌ Error in /source:", e);
          await bot.sendMessage(
            chatId,
            `❌ Внутренняя ошибка при работе с источником "${key}".`
          );
        }

        return;
      }

      case "/diag_source": {
        const key = args.trim();
        if (!key) {
          await bot.sendMessage(
            chatId,
            "Нужно указать key источника. Например: `/diag_source coingecko_global`",
            { parse_mode: "Markdown" }
          );
          return;
        }

        try {
          const result = await Sources.fetchFromSourceKey(key, { diag: true });
          const ok = !!result && result.ok !== false;

          const type = result.type || "unknown";
          const httpStatus =
            typeof result.httpStatus === "number"
              ? result.httpStatus
              : result.meta?.httpStatus ?? "—";

          const payload =
            result.data ||
            result.htmlSnippet ||
            result.xmlSnippet ||
            result.items ||
            null;

          const previewObj = {
            ok: result.ok,
            sourceKey: result.sourceKey || key,
            type,
            httpStatus,
            payload,
          };

          const preview = JSON.stringify(previewObj, null, 2).slice(0, 900);

          const textDiag =
            `📡 Диагностика источника "${previewObj.sourceKey}".\n\n` +
            `Тип: ${type}\n` +
            `HTTP статус: ${httpStatus}\n\n` +
            `📄 Данные (обрезано):\n` +
            preview;

          await bot.sendMessage(chatId, textDiag);
        } catch (e) {
          console.error("❌ Error in /diag_source:", e);
          await bot.sendMessage(
            chatId,
            `❌ Ошибка диагностики источника "${key}".`
          );
        }

        return;
      }

      case "/test_source": {
        const key = args.trim();
        if (!key) {
          await bot.sendMessage(
            chatId,
            "Нужно указать key источника. Например: `/test_source coingecko_global`",
            { parse_mode: "Markdown" }
          );
          return;
        }

        try {
          const res = await Sources.fetchFromSourceKey(key);
          await bot.sendMessage(
            chatId,
            JSON.stringify(res, null, 2).slice(0, 1000)
          );
        } catch (e) {
          console.error("❌ Error in /test_source:", e);
          await bot.sendMessage(chatId, "Ошибка тестового запроса.");
        }

        return;
      }

      case "/pm_set": {
        const isMonarch = chatIdStr === "677128443";
        if (!isMonarch) {
          await bot.sendMessage(
            chatId,
            "Только монарх может менять Project Memory."
          );
          return;
        }

        const raw = args.trim();
        const firstSpace = raw.indexOf(" ");
        const section =
          firstSpace === -1 ? raw : raw.slice(0, firstSpace).trim();
        const content =
          firstSpace === -1 ? "" : raw.slice(firstSpace + 1).trim();

        if (!section) {
          await bot.sendMessage(
            chatId,
            "Нужно указать секцию. Пример:\n`/pm_set roadmap ...`",
            { parse_mode: "Markdown" }
          );
          return;
        }

        if (!content) {
          await bot.sendMessage(
            chatId,
            "Нужно указать текст для секции.\nПример:\n`/pm_set roadmap SG — ROADMAP ...`",
            { parse_mode: "Markdown" }
          );
          return;
        }

        try {
          await upsertProjectSection(
            undefined,
            section,
            `Section: ${section}`,
            content,
            {
              section,
            }
          );

          await bot.sendMessage(
            chatId,
            `✅ Project Memory обновлена для секции "${section}".`
          );
        } catch (e) {
          console.error("❌ Error in /pm_set:", e);
          await bot.sendMessage(
            chatId,
            "Ошибка обновления Project Memory."
          );
        }

        return;
      }

      case "/pm_show": {
        const section = args.trim();
        if (!section) {
          await bot.sendMessage(
            chatId,
            "Нужно указать секцию. Пример:\n`/pm_show roadmap`",
            { parse_mode: "Markdown" }
          );
          return;
        }

        try {
          const record = await getProjectSection(undefined, section);

          if (!record) {
            await bot.sendMessage(
              chatId,
              `Секции "${section}" пока нет в Project Memory.`
            );
            return;
          }

          const textPm =
            `🧠 Project Memory: ${record.section}\n` +
            `Обновлено: ${record.updated_at}\n\n` +
            (record.content.length > 3500
              ? record.content.slice(0, 3500) +
                "\n\n...(обрезано, текст слишком длинный)..."
              : record.content);

          await bot.sendMessage(chatId, textPm);
        } catch (e) {
          console.error("❌ Error in /pm_show:", e);
          await bot.sendMessage(chatId, "Ошибка чтения Project Memory.");
        }

        return;
      }

      case "/mode": {
        const arg = args.trim().toLowerCase();
        const valid = ["short", "normal", "long"];

        if (!valid.includes(arg)) {
          await bot.sendMessage(
            chatId,
            "Режимы:\n" +
              "- short — кратко\n" +
              "- normal — средне\n" +
              "- long — развернуто\n\n" +
              "Пример: `/mode long`",
            { parse_mode: "Markdown" }
          );
          return;
        }

        setAnswerMode(chatIdStr, arg);

        let description = "";
        if (arg === "short") {
          description =
            "короткие ответы (1–2 предложения, минимальные токены).";
        } else if (arg === "normal") {
          description =
            "средние ответы (3–7 предложений, умеренная детализация).";
        } else if (arg === "long") {
          description =
            "развернутые ответы с пунктами и объяснениями.";
        }

        await bot.sendMessage(
          chatId,
          `Режим ответа установлен: ${arg}.\n\n${description}`
        );
        return;
      }

      default:
        break;
    }
  }

    // 2) НЕ-командное сообщение (или неизвестная команда)
  // Формируем итоговый текст с учётом возможных вложений
  let effectiveUserText = trimmed;
  if (mediaSummary) {
    if (!effectiveUserText) {
      effectiveUserText = `Пользователь отправил вложение: ${mediaSummary}. Текстовое описание отсутствует.`;
    } else {
      effectiveUserText += `\n\n(Также: ${mediaSummary})`;
    }
  }

  // Записываем сообщение в память
  await saveMessageToMemory(chatIdStr, "user", effectiveUserText);

  // 3) Классификация взаимодействия
  const classification = classifyInteraction(effectiveUserText);
  try {
    await pool.query(
      `
        INSERT INTO interaction_logs (chat_id, task_type, ai_cost_level)
        VALUES ($1, $2, $3)
      `,
      [
        chatIdStr,
        classification.taskType || "chat",
        classification.aiCostLevel || "low",
      ]
    );
  } catch (err) {
    console.error("❌ Error saving interaction_logs:", err);
  }

  const answerMode = getAnswerMode(chatIdStr);

  // 4) Берём историю чата
  const history = await getChatHistory(chatIdStr, MAX_HISTORY_MESSAGES);

  const projectContext = await loadProjectContext();

  const systemPrompt = buildSystemPrompt({
    answerMode,
    classification,
    projectContext,
  });

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: effectiveUserText },
  ];

  // Параметры модели зависят от режима ответа
  let maxTokens = 400;
  let temperature = 0.6;

  if (answerMode === "short") {
    maxTokens = 180;
    temperature = 0.3;
  } else if (answerMode === "normal") {
    maxTokens = 450;
    temperature = 0.6;
  } else if (answerMode === "long") {
    maxTokens = 900;
    temperature = 0.8;
  }

  let aiReply = "";
  try {
    aiReply = await callAI(messages, classification.aiCostLevel || "low", {
      max_output_tokens: maxTokens,
      temperature,
    });
  } catch (err) {
    console.error("❌ Error calling AI:", err);
    aiReply =
      "⚠️ Ошибка вызова ИИ. Возможно, временная проблема. Попробуйте ещё раз.";
  }

  // Сохраняем связку (user + assistant)
  await saveChatPair(chatIdStr, effectiveUserText, aiReply);

  // Отправляем ответ пользователю
  try {
    await bot.sendMessage(chatId, aiReply);
  } catch (err) {
    console.error("❌ Telegram send error:", err);
  }
});

console.log("🤖 AI Bot is running...");
