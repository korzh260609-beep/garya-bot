// === Импорты ===
import TelegramBot from "node-telegram-bot-api";
import express from "express";
import pool from "./db.js"; // память + профили + tasks
import * as Sources from "./sources.js"; // слой источников
import { classifyInteraction } from "./classifier.js"; // классификатор
import { callAI } from "./ai.js"; // универсальный вызов ИИ
import { buildSystemPrompt } from "./systemPrompt.js";
import { getProjectSection, upsertProjectSection } from "./projectMemory.js";

// === Константы ===
const MAX_HISTORY_MESSAGES = 20;

// === РЕЖИМЫ ОТВЕТОВ (answer_mode) ===
const DEFAULT_ANSWER_MODE = "short";
const answerModeByChat = new Map(); // chatId -> режим

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

    if (roadmap?.content) parts.push(`ROADMAP:\n${roadmap.content}`);
    if (workflow?.content) parts.push(`WORKFLOW:\n${workflow.content}`);

    if (parts.length === 0) return "";

    const fullText = parts.join("\n\n");
    return fullText.slice(0, 4000); // ограничение для промпта
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
  process.exit(1);
}

const bot = new TelegramBot(token);

// === РОЛИ / ПРАВА ===
function isMonarch(chatIdStr) {
  return chatIdStr === "677128443";
}

async function requireMonarch(chatIdStr, commandName) {
  if (!isMonarch(chatIdStr)) {
    await bot.sendMessage(
      chatIdStr,
      `⛔ Команда ${commandName} доступна только монарху Королевства GARYA.`
    );
    return false;
  }
  return true;
}

// === RATE LIMITS ===
const rateLimitState = new Map();

function checkRateLimit(key, minIntervalMs) {
  const now = Date.now();
  const last = rateLimitState.get(key) || 0;
  const diff = now - last;

  if (diff < minIntervalMs) {
    return { limited: true, retryInMs: minIntervalMs - diff };
  }

  rateLimitState.set(key, now);
  return { limited: false, retryInMs: 0 };
}

// === Telegram Webhook ===
const WEBHOOK_URL = `https://garya-bot.onrender.com/webhook/${token}`;
bot.setWebHook(WEBHOOK_URL);

app.get("/", (req, res) => {
  res.send("GARYA AI Bot is alive! ⚡");
});

app.post(`/webhook/${token}`, (req, res) => {
  res.sendStatus(200);
  try {
    bot.processUpdate(req.body);
  } catch (err) {
    console.error("❌ Error in bot.processUpdate:", err);
  }
});

app.get(`/webhook/${token}`, (req, res) => {
  res.send("OK");
});

// === Запуск сервера ===
app.listen(PORT, () => {
  console.log("🌐 Web server started on port:", PORT);

  Sources.ensureDefaultSources()
    .then(() => console.log("📡 Sources registry synced."))
    .catch((err) =>
      console.error("❌ Error initializing sources registry:", err)
    );
});

// === Память диалога ===
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
    return result.rows.reverse().map((row) => ({
      role: row.role,
      content: row.content,
    }));
  } catch (err) {
    console.error("❌ getChatHistory DB error:", err);
    return [];
  }
}

async function saveMessageToMemory(chatId, role, content) {
  if (!content || !content.trim()) return;

  try {
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
    if (last && last.role === role && last.content === content) return;

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
    await saveMessageToMemory(chatId, "user", userText);
    await saveMessageToMemory(chatId, "assistant", assistantText);
  } catch (err) {
    console.error("❌ saveChatPair DB error:", err);
  }
}

// === Профиль пользователя ===
async function ensureUserProfile(msg) {
  const chatId = msg.chat.id.toString();
  const nameFromTelegram = msg.from?.first_name || null;

  let role = "guest";
  let finalName = nameFromTelegram;

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
      const u = existing.rows[0];
      if (u.name !== finalName) {
        await pool.query("UPDATE users SET name = $1 WHERE chat_id = $2", [
          finalName,
          chatId,
        ]);
      }
    }
  } catch (err) {
    console.error("❌ ensureUserProfile error:", err);
  }
}

// === TASK ENGINE ===
async function createDemoTask(userChatId) {
  const payload = { note: "Это демо-задача." };

  const result = await pool.query(
    `
      INSERT INTO tasks (user_chat_id, title, type, payload, schedule, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [
      userChatId,
      "Demo task",
      "demo",
      payload,
      null,
      "active",
    ]
  );

  return result.rows[0].id;
}

async function createManualTask(userChatId, promptText) {
  let title = promptText.trim();
  if (title.length > 60) title = title.slice(0, 57) + "...";

  const payload = { prompt: promptText.trim() };

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
      "0 * * * *",
      "active",
    ]
  );

  return result.rows[0];
}

// === TASK ENGINE (продолжение) ===

// Получить последние задачи пользователя
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

// Получить одну задачу по ID
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
  return result.rows[0] || null;
}

// Изменить статус задачи
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

// Запустить задачу через ИИ
async function runTaskWithAI(task, chatId) {
  if (!process.env.OPENAI_API_KEY) {
    await bot.sendMessage(
      chatId,
      "⚠️ ИИ недоступен (нет OPENAI_API_KEY). Задача не может быть выполнена."
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
Твоя задача — строго выполнять задания пользователя:
— расчёты
— анализ
— логика
— структурированный ответ

Если задача требует внешних API или недоступных данных — НЕ выдумывай.
Опиши, что можно сделать аналитически, и дай полезный план действий.
      `,
    },
    {
      role: "user",
      content: `Задача #${task.id} (${task.type}):\n"${promptText}"`,
    },
  ];

  let reply = "";
  try {
    reply = await callAI(messages, "high");
  } catch (e) {
    console.error("❌ AI error:", e);
    reply = "⚠️ Ошибка вызова ИИ — задача не выполнена.";
  }

  await pool.query("UPDATE tasks SET last_run = NOW() WHERE id = $1", [
    task.id,
  ]);

  await bot.sendMessage(
    chatId,
    `🚀 Задача #${task.id} выполнена.\n\n${reply}`
  );
}

// === SOURCES HELPERS ===

async function getAllSourcesSafe() {
  try {
    if (typeof Sources.getAllSources === "function") {
      return await Sources.getAllSources();
    }
    const res = await pool.query(`SELECT * FROM sources ORDER BY id ASC;`);
    return res.rows;
  } catch (err) {
    console.error("❌ Error in getAllSourcesSafe:", err);
    return [];
  }
}

function formatSourcesList(sources) {
  if (!sources || sources.length === 0) {
    return (
      "📡 Источники данных (Sources Layer)\n\n" +
      "Пока в реестре нет ни одного источника."
    );
  }

  let text = "📡 Источники данных (Sources Layer):\n\n";
  for (const s of sources) {
    const created = s.created_at ? new Date(s.created_at).toISOString() : "—";
    text +=
      `#${s.id} — ${s.name}\n` +
      `Ключ: ${s.key}\n` +
      `Тип: ${s.type}, статус: ${s.is_enabled ? "ON" : "OFF"}\n` +
      (s.url ? `URL: ${s.url}\n` : "") +
      `Создан: ${created}\n\n`;
  }
  return text;
}

// === File & Media Intake (скелет) ===
function describeMediaAttachments(msg) {
  const parts = [];

  if (Array.isArray(msg.photo) && msg.photo.length > 0) parts.push("фото/скриншот");
  if (msg.document) {
    const doc = msg.document;
    const name = doc.file_name || "документ";
    const mime = doc.mime_type ? ` (${doc.mime_type})` : "";
    parts.push(`документ "${name}"${mime}`);
  }
  if (msg.voice) parts.push("голосовое сообщение");
  if (msg.audio) {
    const a = msg.audio;
    const title = a.title || "аудио";
    parts.push(`аудио "${title}"`);
  }
  if (msg.video) parts.push("видео");
  if (msg.sticker) parts.push("стикер");
  if (msg.animation) parts.push("GIF/анимация");

  if (parts.length === 0) return null;
  return parts.join(", ");
}

// === Команда /test_source ===
bot.onText(/\/test_source (.+)/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const key = match[1].trim();

  // 🔒 Только монарх
  if (!(await requireMonarch(chatId, "/test_source"))) return;

  // ⏱ Rate-limit: 1 раз в 10 сек
  const rateKey = `test_source:${chatId}:${key}`;
  const rl = checkRateLimit(rateKey, 10_000);
  if (rl.limited) {
    const sec = Math.ceil(rl.retryInMs / 1000);
    await bot.sendMessage(
      chatId,
      `⏱ /test_source для "${key}" можно вызывать раз в 10 сек. Подожди ${sec} сек.`
    );
    return;
  }

  await bot.sendMessage(chatId, `⏳ Тестирую источник "${key}"...`);

  try {
    const result = await Sources.fetchFromSourceKey(key);

    if (!result.ok) {
      await bot.sendMessage(
        chatId,
        `❌ Ошибка: ${result.error || "неизвестная ошибка"}`
      );
      return;
    }

    const type = result.type || result.sourceType || "—";
    const httpStatus =
      typeof result.httpStatus === "number"
        ? result.httpStatus
        : result.meta?.httpStatus ?? "—";

    const previewObj = {
      ok: result.ok,
      sourceKey: key,
      type,
      httpStatus,
      data:
        result.data ||
        result.htmlSnippet ||
        result.xmlSnippet ||
        result.items ||
        null,
    };

    const preview = JSON.stringify(previewObj, null, 2).slice(0, 800);

    await bot.sendMessage(
      chatId,
      `✅ Источник работает!\n\nКлюч: ${key}\nТип: ${type}\nHTTP: ${httpStatus}\n\n📄 Данные (обрезано):\n${preview}`
    );
  } catch (err) {
    console.error("❌ /test_source error:", err);
    await bot.sendMessage(chatId, `❌ Ошибка: ${err.message}`);
  }
});

// === /diag_source
bot.onText(/\/diag_source (.+)/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const key = match[1].trim();

  if (!(await requireMonarch(chatId, "/diag_source"))) return;

  const rateKey = `diag_source:${chatId}:${key}`;
  const rl = checkRateLimit(rateKey, 10_000);
  if (rl.limited) {
    const sec = Math.ceil(rl.retryInMs / 1000);
    await bot.sendMessage(
      chatId,
      `⏱ /diag_source можно раз в 10 сек. Жди ${sec} сек.`
    );
    return;
  }

  await bot.sendMessage(chatId, `🩺 Диагностика источника "${key}"...`);

  try {
    const result = await Sources.diagnoseSource(key);

    if (!result.ok) {
      await bot.sendMessage(
        chatId,
        `❌ НЕ работает.\nКлюч: ${key}\nТип: ${result.type}\nКод: ${
          result.httpStatus ?? "—"
        }\nОшибка: ${result.error || "unknown"}`
      );
      return;
    }

    const dataPreview = JSON.stringify(result.data, null, 2).slice(0, 800);

    await bot.sendMessage(
      chatId,
      `✅ Источник работает.\nКлюч: ${key}\nТип: ${result.type}\nСтатус: ${
        result.httpStatus ?? "—"
      }\n\n📄 Данные:\n${dataPreview}`
    );
  } catch (err) {
    console.error("❌ /diag_source error:", err);
    await bot.sendMessage(chatId, `❌ Ошибка: ${err.message}`);
  }
});

// === /sources_diag
bot.onText(/\/sources_diag/, async (msg) => {
  const chatId = msg.chat.id.toString();

  if (!(await requireMonarch(chatId, "/sources_diag"))) return;

  const rateKey = `sources_diag:${chatId}`;
  const rl = checkRateLimit(rateKey, 60_000);
  if (rl.limited) {
    const sec = Math.ceil(rl.retryInMs / 1000);
    await bot.sendMessage(
      chatId,
      `⏱ /sources_diag можно вызывать раз в 60 сек. Жди ${sec} сек.`
    );
    return;
  }

  await bot.sendMessage(chatId, "🩺 Запускаю диагностику всех источников...");

  try {
    const results = await Sources.runSourceDiagnosticsOnce();

    let text =
      `🧪 Диагностика завершена.\nВсего: ${results.total}\n` +
      `OK: ${results.okCount}\n` +
      `Ошибки: ${results.failCount}\n\n`;

    for (const item of results.items) {
      text += `• ${item.key} (${item.type}) — ${
        item.ok ? "✅ OK" : `❌ ${item.error}`
      }\n`;
    }

    await bot.sendMessage(chatId, text);
  } catch (err) {
    console.error("❌ /sources_diag error:", err);
    await bot.sendMessage(chatId, "❌ Ошибка диагностики.");
  }
});

// === /mode
bot.onText(/\/mode (short|normal|long)/, async (msg, match) => {
  const chatIdStr = msg.chat.id.toString();
  const mode = match[1];

  setAnswerMode(chatIdStr, mode);

  await bot.sendMessage(
    chatIdStr,
    `🎚 Режим ответов установлен: ${mode.toUpperCase()}`
  );
});

// ========================================================
// === ГЛАВНЫЙ ХЭНДЛЕР СООБЩЕНИЙ ===
// ========================================================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id.toString();

  if (!msg.text && !msg.caption) return;

  await ensureUserProfile(msg);

  const userText = msg.text || msg.caption || "";

  // --- FILE-INTAKE (пока только объявление)
  const attachments = describeMediaAttachments(msg);
  if (attachments) {
    await bot.sendMessage(
      chatId,
      `📎 Получено вложение: ${attachments}\n` +
        `Модуль File-Intake включится на Этапе 7.`
    );
  }

  // --- КЛАССИФИКАЦИЯ
  let classification = null;
  try {
    classification = await classifyInteraction({ userText });
  } catch (err) {
    console.error("❌ classifyInteraction error:", err);
  }

  // --- ЛОГИРОВАНИЕ
  try {
    await logInteraction(chatId, classification);
  } catch (err) {
    console.error("❌ logInteraction error:", err);
  }

  // --- Режим токенов
  const answerMode = getAnswerMode(chatId);

  // --- Если robot-слой вернул ответ
  if (classification?.responseType === "robot") {
    const reply = classification.robotReply || "🤖 Готово.";
    await saveChatPair(chatId, userText, reply);
    await bot.sendMessage(chatId, reply);
    return;
  }

  // --- Если нет OpenAI
  if (!process.env.OPENAI_API_KEY) {
    const text = "⚠️ ИИ недоступен — нет ключа.";
    await saveChatPair(chatId, userText, text);
    await bot.sendMessage(chatId, text);
    return;
  }

  // --- Грузим память + Project Memory
  const history = await getChatHistory(chatId, MAX_HISTORY_MESSAGES);
  const projectMemoryContext = await loadProjectContext();

  const messages = [
    {
      role: "system",
      content: buildSystemPrompt({
        answerMode,
        projectMemoryContext,
      }),
    },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userText },
  ];

  // --- Вызов ИИ
  let reply = "";
  try {
    reply = await callAI(messages, classification?.aiCostLevel || "high");
  } catch (err) {
    console.error("❌ AI error:", err);
    reply = "⚠️ Ошибка вызова ИИ.";
  }

  // --- Сохранение в память
  await saveChatPair(chatId, userText, reply);

  await bot.sendMessage(chatId, reply);
});

// === LOG ===
console.log("🤖 AI Bot is running...");
