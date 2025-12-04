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

// === SOURCES LAYER HELPERS (debug) ===
async function getAllSourcesSafe() {
  try {
    // Новый sources.js экспортирует getAllSources
    if (typeof Sources.getAllSources === "function") {
      const sources = await Sources.getAllSources();
      return sources;
    }

    // Резервный вариант — прямой запрос в БД
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
      "Пока в реестре нет ни одного источника.\n" +
      "Позже мы добавим сюда TradingView, новостные RSS и другие API."
    );
  }

  let text = "📡 Источники данных (Sources Layer):\n\n";
  for (const s of sources) {
    const status = s.enabled === false ? "OFF" : "ON";
    const created = s.created_at ? new Date(s.created_at).toISOString() : "—";

    text +=
      `#${s.id} — ${s.name || "Без названия"}\n` +
      `Ключ: ${s.key || "—"}\n` +
      `Тип: ${s.type || "—"}, статус: ${status}\n` +
      (s.url ? `URL: ${s.url}\n` : "") +
      `Создан: ${created}\n\n`;
  }
  return text;
}

// === File & Media Intake (скелет) ===
// Описание вложений в человеко-читаемом виде для памяти и ИИ
function describeMediaAttachments(msg) {
  const parts = [];

  if (Array.isArray(msg.photo) && msg.photo.length > 0) {
    parts.push("фото/скриншот");
  }

  if (msg.document) {
    const doc = msg.document;
    const name = doc.file_name || "документ";
    const mime = doc.mime_type ? ` (${doc.mime_type})` : "";
    parts.push(`документ "${name}"${mime}`);
  }

  if (msg.voice) {
    parts.push("голосовое сообщение");
  }

  if (msg.audio) {
    const a = msg.audio;
    const title = a.title || "аудио";
    parts.push(`аудио "${title}"`);
  }

  if (msg.video) {
    parts.push("видео");
  }

  if (msg.sticker) {
    parts.push("стикер");
  }

  if (msg.animation) {
    parts.push("GIF/анимация");
  }

  if (parts.length === 0) return null;

  return parts.join(", ");
}

// === КОМАНДА /test_source (для проверки Sources Layer) ===
bot.onText(/\/test_source (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const key = match[1].trim();

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

    const type =
      result.type || result.sourceType || result.meta?.type || "—";

    const httpStatus =
      typeof result.httpStatus === "number"
        ? result.httpStatus
        : result.meta?.httpStatus ?? "—";

    const previewObj = {
      ok: result.ok,
      sourceKey: result.sourceKey || key,
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

    const text =
      `✅ Источник работает!\n\n` +
      `Ключ: ${previewObj.sourceKey}\n` +
      `Тип: ${type}\n` +
      `HTTP статус: ${httpStatus}\n\n` +
      `📄 Данные (обрезано):\n` +
      preview;

    // Без parse_mode, чтобы не ловить 400 Bad Request от Telegram
    await bot.sendMessage(chatId, text);
  } catch (err) {
    console.error("❌ /test_source error:", err);
    await bot.sendMessage(chatId, `❌ Ошибка выполнения: ${err.message}`);
  }
});

// === ЛОГИРОВАНИЕ ВЗАИМОДЕЙСТВИЙ (interaction_logs) ===
async function logInteraction(chatIdStr, classification) {
  try {
    const taskType = classification?.taskType || "chat";
    const aiCostLevel = classification?.aiCostLevel || "low";

    await pool.query(
      `
        INSERT INTO interaction_logs (chat_id, task_type, ai_cost_level)
        VALUES ($1, $2, $3)
      `,
      [chatIdStr, taskType, aiCostLevel]
    );
  } catch (err) {
    console.error("❌ Error in logInteraction:", err);
  }
}

// === ОБРАБОТКА СООБЩЕНИЙ ===
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = chatId.toString();

  // исходный текст сообщения (может быть пустым, если только файл/фото)
  const rawText = msg.text || "";

  // человеко-читаемое описание вложений (если есть)
  const mediaSummary = describeMediaAttachments(msg);
  if (mediaSummary) {
    console.log("📎 Media message:", mediaSummary);
  }

  // если нет ни текста, ни вложений — ничего не делаем
  if (!rawText.trim() && !mediaSummary) {
    return;
  }

  // эффективный текст, который пойдёт в классификатор, ИИ и память
  let effectiveUserText = rawText || "";
  if (mediaSummary) {
    if (effectiveUserText.trim().length === 0) {
      // чистое вложение без текста
      effectiveUserText =
        `Пользователь отправил вложение: ${mediaSummary}. ` +
        "Содержимое файла пока не распознаётся автоматически, но вложение важно для контекста.";
    } else {
      // текст + вложение
      effectiveUserText =
        `${effectiveUserText}\n\n[Вложение: ${mediaSummary}]`;
    }
  }

  try {
    // 1) профиль
    await ensureUserProfile(msg);

    // 2) Определяем, есть ли команда
    let command = null;
    let commandArgs = "";

    if (Array.isArray(msg.entities)) {
      const cmdEntity = msg.entities.find(
        (e) => e.type === "bot_command" && e.offset === 0
      );
      if (cmdEntity) {
        const rawCmd = rawText.slice(0, cmdEntity.length);
        command = rawCmd.split("@")[0];
        commandArgs = rawText.slice(cmdEntity.length).trim();
      }
    }

    // 3) Если это команда — обрабатываем и НЕ идём в OpenAI
    if (command) {
      switch (command) {
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
              "Не удалось получить профиль из базы данных."
            );
          }
          return;
        }

        case "/addtask_test": {
          try {
            const taskId = await createDemoTask(chatIdStr);
            await bot.sendMessage(
              chatId,
              `✅ Демо-задача создана в Task Engine.\nID задачи: ${taskId}`
            );
          } catch (e) {
            console.error("❌ Error in /addtask_test:", e);
            await bot.sendMessage(
              chatId,
              "Не удалось создать демо-задачу в Task Engine."
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
                `Расписание (cron): 0 * * * *\n` +
                `Создана: ${task.created_at?.toISOString?.() || "—"}`
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
          const taskText = commandArgs;
          if (!taskText) {
            await bot.sendMessage(
              chatId,
              "Использование:\n`/newtask описание задачи`\n\nНапример:\n`/newtask следи за ценой BTC раз в час`",
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
          if (!commandArgs) {
            await bot.sendMessage(
              chatId,
              "Использование:\n`/run ID_задачи`\n\nНапример:\n`/run 2`",
              { parse_mode: "Markdown" }
            );
            return;
          }

          const taskId = parseInt(commandArgs.split(/\s+/)[0], 10);

          if (Number.isNaN(taskId)) {
            await bot.sendMessage(
              chatId,
              "ID задачи должен быть числом. Пример: `/run 2`",
              { parse_mode: "Markdown" }
            );
            return;
          }

          try {
            const task = await getTaskById(chatIdStr, taskId);
            if (!task) {
              await bot.sendMessage(
                chatId,
                `Я не нашёл задачу #${taskId} среди ваших задач.`
              );
              return;
            }

            await bot.sendMessage(
              chatId,
              `🚀 Запускаю задачу #${task.id}: "${task.title}"`
            );
            await runTaskWithAI(task, chatId);
          } catch (e) {
            console.error("❌ Error in /run:", e);
            await bot.sendMessage(
              chatId,
              "Не удалось запустить задачу через Task Engine."
            );
          }
          return;
        }

        case "/tasks": {
          try {
            const tasks = await getUserTasks(chatIdStr, 10);

            if (tasks.length === 0) {
              await bot.sendMessage(
                chatId,
                "У вас пока нет задач в Task Engine."
              );
            } else {
              let text = "📋 Ваши последние задачи:\n\n";
              for (const t of tasks) {
                text +=
                  `#${t.id} — ${t.title}\n` +
                  `Тип: ${t.type}, статус: ${t.status}\n` +
                  `Создана: ${t.created_at?.toISOString?.() || "—"}\n` +
                  (t.schedule ? `Расписание: ${t.schedule}\n` : "") +
                  (t.last_run
                    ? `Последний запуск: ${t.last_run.toISOString()}\n`
                    : "") +
                  `\n`;
              }
              await bot.sendMessage(chatId, text);
            }
          } catch (e) {
            console.error("❌ Error in /tasks:", e);
            await bot.sendMessage(
              chatId,
              "Не удалось получить список задач из Task Engine."
            );
          }
          return;
        }

        // Универсальная команда /task
        case "/task": {
          const raw = commandArgs.trim();

          // без аргументов — помощь
          if (!raw) {
            await bot.sendMessage(
              chatId,
              "Команда `/task` — работа с задачами Task Engine.\n\n" +
                "Варианты использования:\n" +
                "• `/task list` — показать список ваших задач\n" +
                "• `/task new <описание>` — создать новую задачу\n" +
                "• `/task <id>` — показать подробности задачи по ID\n" +
                "• `/task pause <id>` — поставить задачу на паузу\n" +
                "• `/task resume <id>` — возобновить задачу\n" +
                "• `/task delete <id>` — пометить задачу как удалённую\n\n" +
                "Примеры:\n" +
                "• `/task list`\n" +
                "• `/task new следи за ценой BTC раз в час`\n" +
                "• `/task 10`\n" +
                "• `/task pause 10`\n" +
                "• `/task resume 10`\n" +
                "• `/task delete 10`",
              { parse_mode: "Markdown" }
            );
            return;
          }

          const parts = raw.split(/\s+/);
          const first = parts[0];
          const firstLower = first.toLowerCase();
          const restText = parts.slice(1).join(" ").trim();

          // /task list
          if (firstLower === "list") {
            try {
              const tasks = await getUserTasks(chatIdStr, 10);

              if (tasks.length === 0) {
                await bot.sendMessage(
                  chatId,
                  "У вас пока нет задач в Task Engine."
                );
              } else {
                let text = "📋 Ваши задачи:\n\n";
                for (const t of tasks) {
                  text +=
                    `#${t.id} — ${t.title}\n` +
                    `Тип: ${t.type}, статус: ${t.status}\n` +
                    `Создана: ${t.created_at?.toISOString?.() || "—"}\n` +
                    (t.schedule ? `Расписание: ${t.schedule}\n` : "") +
                    (t.last_run
                      ? `Последний запуск: ${t.last_run.toISOString()}\n`
                      : "") +
                    `\n`;
                }
                await bot.sendMessage(chatId, text);
              }
            } catch (e) {
              console.error("❌ Error in /task list:", e);
              await bot.sendMessage(
                chatId,
                "Не удалось получить список задач из Task Engine."
              );
            }
            return;
          }

          // /task new <описание>
          if (firstLower === "new") {
            if (!restText) {
              await bot.sendMessage(
                chatId,
                "Использование:\n`/task new <описание задачи>`\n\n" +
                  "Пример:\n`/task new следи за ценой BTC раз в час`",
                { parse_mode: "Markdown" }
              );
              return;
            }

            try {
              const task = await createManualTask(chatIdStr, restText);

              await bot.sendMessage(
                chatId,
                `🆕 Задача создана!\n\n` +
                  `#${task.id} — manual\n` +
                  `Статус: active\n` +
                  `Описание: ${restText}\n` +
                  `Создана: ${task.created_at?.toISOString?.() || "—"}`
              );
            } catch (e) {
              console.error("❌ Error in /task new:", e);
              await bot.sendMessage(
                chatId,
                "Не удалось создать задачу в Task Engine."
              );
            }
            return;
          }

          // /task pause|resume|delete <id>
          if (
            firstLower === "pause" ||
            firstLower === "resume" ||
            firstLower === "delete"
          ) {
            if (!restText) {
              await bot.sendMessage(
                chatId,
                "Нужно указать ID задачи.\n\nПримеры:\n" +
                  "`/task pause 10`\n" +
                  "`/task resume 10`\n" +
                  "`/task delete 10`",
                { parse_mode: "Markdown" }
              );
              return;
            }

            const idStr = restText.split(/\s+/)[0];
            const taskId = parseInt(idStr, 10);

            if (Number.isNaN(taskId)) {
              await bot.sendMessage(
                chatId,
                "ID задачи должен быть числом.\nПример: `/task pause 10`",
                { parse_mode: "Markdown" }
              );
              return;
            }

            try {
              const existing = await getTaskById(chatIdStr, taskId);
              if (!existing) {
                await bot.sendMessage(
                  chatId,
                  `Я не нашёл задачу #${taskId} среди ваших задач.`
                );
                return;
              }

              let newStatus = existing.status;
              let msgText = "";

              if (firstLower === "pause") {
                newStatus = "paused";
                msgText = `⏸ Задача #${taskId} поставлена на паузу.`;
              } else if (firstLower === "resume") {
                newStatus = "active";
                msgText = `▶️ Задача #${taskId} возобновлена.`;
              } else if (firstLower === "delete") {
                newStatus = "deleted";
                msgText = `🗑 Задача #${taskId} помечена как удалённая.`;
              }

              await updateTaskStatus(chatIdStr, taskId, newStatus);
              await bot.sendMessage(chatId, msgText);
            } catch (e) {
              console.error("❌ Error in /task pause|resume|delete:", e);
              await bot.sendMessage(
                chatId,
                "Не удалось изменить статус задачи."
              );
            }
            return;
          }

          // /task <id> — показать одну задачу
          const taskId = parseInt(first, 10);
          if (Number.isNaN(taskId)) {
            await bot.sendMessage(
              chatId,
              "Не понимаю аргумент после `/task`.\n\n" +
                "Использование:\n" +
                "• `/task list`\n" +
                "• `/task new <описание>`\n" +
                "• `/task <id>` (id — число)\n" +
                "• `/task pause <id>`\n" +
                "• `/task resume <id>`\n" +
                "• `/task delete <id>`",
              { parse_mode: "Markdown" }
            );
            return;
          }

          try {
            const task = await getTaskById(chatIdStr, taskId);
            if (!task) {
              await bot.sendMessage(
                chatId,
                `Я не нашёл задачу #${taskId} среди ваших задач.`
              );
              return;
            }

            const text =
              `🔍 Задача #${task.id}\n\n` +
              `Название: ${task.title}\n` +
              `Тип: ${task.type}\n` +
              `Статус: ${task.status}\n` +
              `Создана: ${task.created_at?.toISOString?.() || "—"}\n` +
              (task.schedule ? `Расписание: ${task.schedule}\n` : "") +
              (task.last_run
                ? `Последний запуск: ${task.last_run.toISOString()}\n`
                : "") +
              `\n` +
              `Задачу можно запустить командой: \`/run ${task.id}\``;

            await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
          } catch (e) {
            console.error("❌ Error in /task <id>:", e);
            await bot.sendMessage(
              chatId,
              "Не удалось получить данные задачи из Task Engine."
            );
          }
          return;
        }

        case "/meminfo": {
          try {
            const res = await pool.query(
              `
            SELECT id, role, content
            FROM chat_memory
            WHERE chat_id = $1
            ORDER BY id DESC
            LIMIT 5
            `,
              [chatIdStr]
            );

            const countRes = await pool.query(
              "SELECT COUNT(*) FROM chat_memory WHERE chat_id = $1",
              [chatIdStr]
            );

            const count = countRes.rows[0].count;

            let text = `🧠 Память чата\nВсего сообщений: ${count}\n\nПоследние 5 записей:\n`;

            for (const row of res.rows.reverse()) {
              text += `\n• [${row.role}] ${row.content.slice(0, 50)}${
                row.content.length > 50 ? "..." : ""
              }`;
            }

            await bot.sendMessage(chatId, text);
          } catch (e) {
            console.error("❌ /meminfo error:", e);
            await bot.sendMessage(chatId, "Не удалось получить данные памяти.");
          }
          return;
        }

        case "/memstats": {
          try {
            const totalRes = await pool.query(
              "SELECT COUNT(*) FROM chat_memory WHERE chat_id = $1",
              [chatIdStr]
            );

            const latestRes = await pool.query(
              `
            SELECT role, content, created_at
            FROM chat_memory
            WHERE chat_id = $1
            ORDER BY id DESC
            LIMIT 1
            `,
              [chatIdStr]
            );

            const total = totalRes.rows[0].count;
            let latestBlock = "Последняя запись: отсутствует.";

            if (latestRes.rows.length > 0) {
              const row = latestRes.rows[0];
              const snippet =
                row.content.length > 120
                  ? row.content.substring(0, 117) + "..."
                  : row.content;
              latestBlock =
                `Последняя запись:\n` +
                `🕒 ${row.created_at}\n` +
                `🎭 Роль: ${row.role}\n` +
                `💬 Текст: ${snippet}`;
            }

            const text =
              `📊 Статус долговременной памяти\n` +
              `Всего сообщений в памяти: ${total}\n\n` +
              `${latestBlock}`;

            await bot.sendMessage(chatId, text);
          } catch (e) {
            console.error("❌ /memstats error:", e);
            await bot.sendMessage(chatId, "Ошибка чтения памяти.");
          }
          return;
        }

        case "/sources": {
          try {
            const sources = await getAllSourcesSafe();
            const text = formatSourcesList(sources);
            await bot.sendMessage(chatId, text);
          } catch (e) {
            console.error("❌ Error in /sources:", e);
            await bot.sendMessage(
              chatId,
              "Не удалось получить список источников."
            );
          }
          return;
        }

        // Новая команда: диагностика всех источников
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
              lines.push("Проблемные источники:");
              for (const item of summary.items) {
                if (item.ok) continue;
                lines.push(
                  `- ${item.key} (${item.type || "?"}): HTTP ${
                    item.httpStatus ?? "—"
                  } — ${item.error || "ошибка"}`
                );
              }
            }

            await bot.sendMessage(chatId, lines.join("\n"));
          } catch (e) {
            console.error("❌ Error in /sources_diag:", e);
            await bot.sendMessage(
              chatId,
              "Не удалось выполнить диагностику всех источников."
            );
          }
          return;
        }

        // Новая команда: /source <key> — реальный запрос к источнику (без Markdown)
        case "/source": {
          const key = commandArgs.split(/\s+/)[0];

          if (!key) {
            await bot.sendMessage(
              chatId,
              "Использование:\n" +
                "/source <key>\n\nПримеры:\n" +
                "/source html_example_page\n" +
                "/source rss_example_news\n" +
                "/source generic_public_markets"
            );
            return;
          }

          await bot.sendMessage(chatId, `⏳ Запрашиваю источник "${key}"...`);

          try {
            const result = await Sources.fetchFromSourceKey(key);

            if (!result.ok) {
              await bot.sendMessage(
                chatId,
                `❌ Ошибка при обращении к источнику "${key}":\n${
                  result.error || "неизвестная ошибка"
                }`
              );
              return;
            }

            const type =
              result.type || result.sourceType || result.meta?.type || "—";

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

            const text =
              `✅ Ответ от источника "${previewObj.sourceKey}".\n\n` +
              `Тип: ${type}\n` +
              `HTTP статус: ${httpStatus}\n\n` +
              `📄 Предпросмотр данных (обрезано):\n` +
              preview;

            await bot.sendMessage(chatId, text);
          } catch (e) {
            console.error("❌ Error in /source:", e);
            await bot.sendMessage(
              chatId,
              `❌ Внутренняя ошибка при обращении к источнику "${key}": ${e.message}`
            );
          }
          return;
        }

        case "/diag_source": {
          const key = commandArgs.split(/\s+/)[0];

          if (!key) {
            await bot.sendMessage(
              chatId,
              "Использование:\n" +
                "/diag_source <key>\n\nПримеры:\n" +
                "/diag_source html_example\n" +
                "/diag_source rss_hackernews\n" +
                "/diag_source coingecko_simple_price"
            );
            return;
          }

          await bot.sendMessage(chatId, `🩺 Диагностирую источник "${key}"...`);

          try {
            const result = await Sources.diagnoseSource(key);

            const ok = result.ok === true;
            const type = result.type || "—";
            const httpStatus =
              typeof result.httpStatus === "number"
                ? result.httpStatus
                : "—";

            const msgLines = [
              `🧪 Результат диагностики источника "${result.sourceKey || key}":`,
              "",
              `Статус: ${ok ? "✅ OK" : "❌ ПРОБЛЕМА"}`,
              `Тип: ${type}`,
              `HTTP статус: ${httpStatus}`,
            ];

            if (!ok && result.error) {
              msgLines.push("", `Ошибка: ${result.error}`);
            }

            await bot.sendMessage(chatId, msgLines.join("\n"));
          } catch (e) {
            console.error("❌ Error in /diag_source:", e);
            await bot.sendMessage(
              chatId,
              `❌ Внутренняя ошибка при диагностике источника "${key}": ${e.message}`
            );
          }

          return;
        }

        case "/test_source": {
          // Обработчик уже реализован через bot.onText выше,
          // здесь просто выходим, чтобы не срабатывать "неизвестная команда".
          return;
        }

        // === ПРОЕКТНАЯ ПАМЯТЬ: /pm_set и /pm_show ===
        case "/pm_set": {
          const userIsMonarch = chatIdStr === "677128443";

          if (!userIsMonarch) {
            await bot.sendMessage(
              chatId,
              "У вас нет прав изменять проектную память. Только монарх может это делать."
            );
            return;
          }

          const raw = commandArgs.trim();

          if (!raw) {
            await bot.sendMessage(
              chatId,
              "Использование:\n" +
                "`/pm_set <section> <текст>`\n\nПримеры:\n" +
                "`/pm_set roadmap ...текст roadmap...`\n" +
                "`/pm_set workflow ...текст workflow...`",
              { parse_mode: "Markdown" }
            );
            return;
          }

          const firstSpace = raw.indexOf(" ");
          const section =
            firstSpace === -1 ? raw : raw.slice(0, firstSpace).trim();
          const content =
            firstSpace === -1 ? "" : raw.slice(firstSpace + 1).trim();

          if (!section) {
            await bot.sendMessage(
              chatId,
              "Нужно указать секцию. Пример:\n`/pm_set roadmap ...текст...`",
              { parse_mode: "Markdown" }
            );
            return;
          }

          if (!content) {
            await bot.sendMessage(
              chatId,
              "Нужно указать текст для записи в проектную память.\n" +
                "Пример:\n`/pm_set roadmap ROADMAP V1.5 ...`",
              { parse_mode: "Markdown" }
            );
            return;
          }

          try {
            const title = `Section: ${section}`;
            const meta = {
              updated_by: "monarch",
              source: "telegram_command",
            };

            const record = await upsertProjectSection({
              section,
              title,
              content,
              tags: [section],
              meta,
              schemaVersion: 1,
            });

            await bot.sendMessage(
              chatId,
              `✅ Проектная память обновлена.\n` +
                `Секция: *${record.section}*\n` +
                `ID записи: ${record.id}\n` +
                `Длина текста: ${record.content.length} символов.`,
              { parse_mode: "Markdown" }
            );
          } catch (e) {
            console.error("❌ /pm_set error:", e);
            await bot.sendMessage(
              chatId,
              "Не удалось записать проектную память. См. логи сервера."
            );
          }

          return;
        }

        case "/pm_show": {
          const raw = commandArgs.trim();

          if (!raw) {
            await bot.sendMessage(
              chatId,
              "Использование:\n`/pm_show <section>`\n\nПримеры:\n" +
                "`/pm_show roadmap`\n" +
                "`/pm_show workflow`",
              { parse_mode: "Markdown" }
            );
            return;
          }

          const section = raw.split(/\s+/)[0];

          try {
            const record = await getProjectSection(undefined, section);

            if (!record) {
              await bot.sendMessage(
                chatId,
                `В проектной памяти пока нет секции "${section}".`
              );
              return;
            }

            const maxLen = 3500;
            const textSnippet =
              record.content.length > maxLen
                ? record.content.slice(0, maxLen) +
                  "\n\n...(обрезано, текст слишком длинный)..."
                : record.content;

            const msg =
              `🧠 Project Memory: ${record.section}\n` +
              `ID: ${record.id}\n` +
              `Обновлено: ${record.updated_at}\n\n` +
              textSnippet;

            await bot.sendMessage(chatId, msg);
          } catch (e) {
            console.error("❌ /pm_show error:", e);
            await bot.sendMessage(
              chatId,
              "Не удалось прочитать проектную память. См. логи сервера."
            );
          }

          return;
        }

        case "/mode": {
          const arg = commandArgs.toLowerCase();
          const valid = ["short", "normal", "long"];

          if (!valid.includes(arg)) {
            await bot.sendMessage(
              chatId,
              "Режимы ответа:\n" +
                "- short  — очень кратко (до 1–2 предложений)\n" +
                "- normal — средне, 3–7 предложений\n" +
                "- long   — развернуто, с пунктами и объяснениями\n\n" +
                "Использование:\n`/mode short`\n`/mode normal`\n`/mode long`",
              { parse_mode: "Markdown" }
            );
            return;
          }

          setAnswerMode(chatIdStr, arg);

          let desc = "";
          if (arg === "short") {
            desc =
              "короткие ответы (1–2 предложения, без лишних деталей, с приоритетом экономии токенов).";
          } else if (arg === "normal") {
            desc =
              "средние ответы (3–7 предложений, немного деталей, умеренная экономия токенов).";
          } else if (arg === "long") {
            desc =
              "развернутые ответы с пунктами и объяснениями (больше токенов, максимум пользы).";
          }

          await bot.sendMessage(
            chatId,
            `✅ Режим ответов установлен: *${arg}* — ${desc}`,
            { parse_mode: "Markdown" }
          );
          return;
        }

        default: {
          await bot.sendMessage(
            chatId,
            "Кажется, я не знаю такую команду.\nДоступные сейчас команды:\n" +
              "/profile, /whoami, /me\n" +
              "/addtask_test\n" +
              "/btc_test_task\n" +
              "/newtask <описание>\n" +
              "/run <id>\n" +
              "/tasks\n" +
              "/task <list|new|pause|resume|delete|id>\n" +
              "/meminfo\n" +
              "/memstats\n" +
              "/sources\n" +
              "/sources_diag\n" +
              "/source <key>\n" +
              "/diag_source <key>\n" +
              "/test_source <key>\n" +
              "/pm_set <section> <text>\n" +
              "/pm_show <section>\n" +
              "/mode <short|normal|long>"
          );
          return;
        }
      }
    }

    // 3.5) Классификация запроса (скелет модуля)
    const classification = classifyInteraction({ userText: effectiveUserText });
    console.log("🧮 classifyInteraction:", classification);
    await logInteraction(chatIdStr, classification);

    // 4) если нет ключа OpenAI — простой ответ
    if (!process.env.OPENAI_API_KEY) {
      await bot.sendMessage(
        chatId,
        "Привет! 🐉 Бот Королевства GARYA работает на сервере, но ИИ сейчас выключен (нет ключа)."
      );
      return;
    }

    // 5) история + системный промпт
    const history = await getChatHistory(chatIdStr, MAX_HISTORY_MESSAGES);
    const answerMode = getAnswerMode(chatIdStr);

    let modeInstruction = "";
    if (answerMode === "short") {
      modeInstruction =
        "Отвечай максимально кратко: 1–2 предложения, без списков и лишних деталей. Если такой краткости недостаточно и ответ станет опасным, непонятным или может ввести в заблуждение — игнорируй ограничение short и расширь ответ до минимально достаточного объёма (примерно как normal).";
    } else if (answerMode === "normal") {
      modeInstruction =
        "Отвечай средне по объёму: примерно 3–7 предложений. Можно использовать 2–3 коротких пункта, если это делает ответ яснее.";
    } else if (answerMode === "long") {
      modeInstruction =
        "Отвечай развернуто: используй структурированные списки, пояснения и примеры, но избегай пустой воды.";
    }

    // проектный контекст из project_memory
    const projectContext = await loadProjectContext();

    const systemPrompt = buildSystemPrompt(
      answerMode,
      modeInstruction,
      projectContext
    );

    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...history,
      { role: "user", content: effectiveUserText },
    ];

    // === Вызов ИИ через единый слой ai.js ===
    let reply = "";
    try {
      reply = await callAI(messages, "high");
    } catch (e) {
      console.error("❌ AI error:", e);
      reply = "⚠️ ИИ временно недоступен — произошла ошибка при вызове модели.";
    }

    await bot.sendMessage(chatId, reply);

    // Сохраняем уже "эффективный" текст (с описанием вложений),
    // чтобы в памяти явно отражалось, что были файлы/скрины.
    if (!rawText.startsWith("/")) {
      await saveChatPair(chatIdStr, effectiveUserText, reply);
    }
  } catch (err) {
    console.error("OpenAI error:", err);
    await bot.sendMessage(
      chatId,
      "🐉 Бот GARYA онлайн, но ИИ сейчас недоступен."
    );
  }
});

// === ROBOT-LAYER (mock режим без реального API) ===

// Получает активные задачи с расписанием
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

// Память mock-цен: taskId -> { price, lastCheck }
const mockPriceState = new Map();

// Главный "тик" робота
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
        const userChatId = Number(t.user_chat_id) || t.user_chat_id;

        const text =
          `⚠️ Mock-сигнал по задаче #${t.id} (${symbol}).\n` +
          `Изменение mock-цены между двумя проверками: ${changePercent.toFixed(
            2
          )}%.\n` +
          `Текущая mock-цена: ${newPrice.toFixed(2)}\n` +
          `Направление: ${direction}.\n` +
          `Это ТЕСТОВЫЙ режим без реального биржевого API.`;

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

// начальная mock-цена по символу
function getInitialMockPrice(symbolRaw) {
  const symbol = (symbolRaw || "BTCUSDT").toUpperCase();
  let base = 60000;

  if (symbol.includes("ETH")) base = 3000;
  else if (symbol.includes("SOL")) base = 150;
  else if (symbol.includes("XRP")) base = 0.6;

  return base;
}

// Запускаем робота раз в 30 секунд
setInterval(() => {
  robotTick();
}, 30_000);

console.log("🤖 AI Bot is running...");
