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
