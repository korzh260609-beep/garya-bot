import TelegramBot from "node-telegram-bot-api";
import express from "express";
import pool from "./db.js"; // память + профили + tasks
import * as Sources from "./sources.js"; // скелет слоя источников
import { classifyInteraction } from "./classifier.js"; // скелет классификатора
import { callAI } from "./ai.js"; // универсальный вызов ИИ
import { buildSystemPrompt } from "./systemPrompt.js";

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

// === Express сервер для Render ===
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// === Telegram Bot ===
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN is missing!");
  console.error(
    "Убедись, что переменная окружения TELEGRAM_BOT_TOKEN задана на Render."
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
    const sources = await Sources.listActiveSources();
    return sources;
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
    text +=
      `#${s.id} — ${s.name || "Без названия"}\n` +
      `Тип: ${s.type || "—"}, статус: ${s.is_enabled ? "ON" : "OFF"}\n` +
      (s.created_at ? `Создан: ${s.created_at.toISOString?.()}\n` : "") +
      `\n`;
  }
  return text;
}

// === ЛОГИРОВАНИЕ ВЗАИМОДЕЙСТВИЙ (interaction_logs) ===
async function logInteraction(chatIdStr, classification) {
  try {
    const taskType = classification?.taskType || "chat";
    const aiCostLevel = classification?.aiCostLevel || "low";

 // === ОБРАБОТКА СООБЩЕНИЙ ===
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = chatId.toString();
  const userText = msg.text || "";

  if (!userText.trim()) return;

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
        const rawCmd = userText.slice(0, cmdEntity.length);
        command = rawCmd.split("@")[0];
        commandArgs = userText.slice(cmdEntity.length).trim();
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
              let msg = "";

              if (firstLower === "pause") {
                newStatus = "paused";
                msg = `⏸ Задача #${taskId} поставлена на паузу.`;
              } else if (firstLower === "resume") {
                newStatus = "active";
                msg = `▶️ Задача #${taskId} возобновлена.`;
              } else if (firstLower === "delete") {
                newStatus = "deleted";
                msg = `🗑 Задача #${taskId} помечена как удалённая.`;
              }

              await updateTaskStatus(chatIdStr, taskId, newStatus);
              await bot.sendMessage(chatId, msg);
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

            let text =
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
            await bot.sendMessage(
              chatId,
              "Не удалось получить данные памяти."
            );
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

        // Тестовый пинг Sources Layer (пока без реального интернета — скелет)
        case "/source_ping": {
          try {
            const result = await Sources.fetchFromSource("coingecko_ping", {
              test: true,
            });

            let text = "🔎 Тест скелета Sources Layer: `coingecko_ping`\n\n";

            if (!result) {
              text += "❌ fetchFromSource не вернул результат.";
            } else {
              if (result.warning) {
                text += `⚠️ Предупреждение: ${result.warning}\n`;
              }
              if (result.error) {
                text += `❌ Ошибка: ${result.error}\n`;
              }
              if (result.ok) {
                text += `✅ ok = true\n`;
              } else {
                text += `ok = ${String(result.ok)}\n`;
              }
              if (result.status) {
                text += `HTTP статус (если был): ${result.status}\n`;
              }
            }

            await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
          } catch (e) {
            console.error("❌ Error in /source_ping:", e);
            await bot.sendMessage(
              chatId,
              "Не удалось выполнить тестовый вызов Sources Layer."
            );
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
              "/source_ping\n" +
              "/sources\n" +
              "/mode <short|normal|long>"
          );
          return;
        }
      }
    }

    // 3.5) Классификация запроса (скелет модуля)
    const classification = classifyInteraction({ userText });
    console.log("🧮 classifyInteraction:", classification);
    await logInteraction(chatIdStr, classification);

    // 4) если нет ключа OpenAI — простой ответ
    if (!process.env.OPENAI_API_KEY) {
      await bot.sendMessage(
        chatId,
        "Привет! 🐉 Бот Королевства GARYA работает на Render!"
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

    const systemPrompt = buildSystemPrompt(answerMode, modeInstruction);

    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...history,
      { role: "user", content: userText },
    ];

    // === Вызов ИИ через единый слой ai.js ===
    let reply = "";
    try {
      reply = await callAI(messages, "high");
    } catch (e) {
      console.error("❌ AI error:", e);
      reply =
        "⚠️ ИИ временно недоступен — произошла ошибка при вызове модели.";
    }

    await bot.sendMessage(chatId, reply);

    if (!userText.startsWith("/")) {
      await saveChatPair(chatIdStr, userText, reply);
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
