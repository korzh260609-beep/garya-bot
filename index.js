import TelegramBot from "node-telegram-bot-api";
import express from "express";
import OpenAI from "openai";
import pool from "./db.js"; // память + профили + tasks
import * as Sources from "./sources.js"; // скелет слоя источников

// === Константы ===
const MAX_HISTORY_MESSAGES = 20;

// === Express сервер для Render ===
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
  console.log("🌐 Web server started on port: " + PORT);
});

// === OpenAI ===
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
    return result.rows.reverse().map((row) => ({
      role: row.role,
      content: row.content,
    }));
  } catch (err) {
    console.error("❌ getChatHistory DB error:", err);
    // если база недоступна или таблица другая — не ломаем бота, просто без истории
    return [];
  }
}

// авто-очистка: оставляем только последние MAX_HISTORY_MESSAGES записей
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

async function saveChatPair(chatId, userText, assistantText) {
  try {
    await pool.query(
      `
        INSERT INTO chat_memory (chat_id, role, content)
        VALUES
          ($1, 'user', $2),
          ($1, 'assistant', $3)
      `,
      [chatId, userText, assistantText]
    );

    // после сохранения — чистим старые сообщения
    await cleanupChatHistory(chatId, MAX_HISTORY_MESSAGES);
  } catch (err) {
    console.error("❌ saveChatPair DB error:", err);
    // не спамим пользователя ошибками, просто лог
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
        await pool.query(
          "UPDATE users SET name = $1 WHERE chat_id = $2",
          [finalName, chatId]
        );
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
    interval_minutes: 60, // раз в час — на будущее
    threshold_percent: 2, // порог изменения цены, на будущее
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
      "0 * * * *", // cron: каждый час, в 00 минут
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

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages,
  });

  let reply = completion.choices[0]?.message?.content ?? "";
  if (typeof reply !== "string") reply = JSON.stringify(reply);

  // отмечаем время запуска
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
      `Тип: ${s.type || "—"}, статус: ${s.enabled ? "ON" : "OFF"}\n\n`;
  }
  return text;
}

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
        const rawCmd = userText.slice(0, cmdEntity.length); // например "/btc_test_task@Bot"
        command = rawCmd.split("@")[0]; // убираем @имябота
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
              "/meminfo\n" +
              "/sources"
          );
          return;
        }
      }
    }

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

    const messages = [
      {
        role: "system",
        content: `
Ты — ИИ-Советник Королевства GARYA, твое имя «Советник».
Ты всегда знаешь, что монарх этого королевства — GARY.

У тебя есть ТРИ уровня обращения к монарху:

1) ОФИЦИАЛЬНО:
   Формула: «Ваше Величество Монарх GARY».
   Используй, если:
   — речь о власти, решениях по королевству, токеномике, дипломатии, важных документах;
   — монарх спрашивает «кто я», «как ко мне обращаться», просит «официально»;
   — формальные отчёты и стратегические обсуждения.

2) ОБЫЧНО (повседневно):
   Формула: «GARY».
   Используй, если:
   — обычный дружеский диалог;
   — вопросы про жизнь, советы, бытовые вещи, лёгкое общение;
   — нет явного запроса на официальность.

3) ПРИВИЛЕГИРОВАННО / ДОВЕРИТЕЛЬНО:
   Возможные формулы:
   — «Мой Монарх»;
   — «Государь GARY»;
   — реже, как усиление: «Владыка GARY».
   Используй, если:
   — монарх пишет в тёплом тоне, с хорошим настроением (например, много «)» или «))»);
   — просит личный совет, делится эмоциями;
   — явно просит говорить по-простому, но с уважением.
   Не злоупотребляй этим стилем, используй его как особый знак уважения и близости.

Дополнительные правила:
— Никогда не используй имя монарха из Telegram-профиля, монарх для тебя всегда GARY.
— Если видишь «((» и грустный тон — будь мягким, но можешь использовать обычный стиль «GARY» или «Мой Монарх» без лишнего пафоса.
— Ко всем остальным пользователям обращайся нейтрально, без монарших титулов.
— Всегда помни контекст диалога (историю сообщений), будь кратким, дружелюбным и полезным.
— Если монарх явно просит: «обратись ко мне официально» или «просто» — строго следуй его указанию.
        `,
      },
      ...history,
      { role: "user", content: userText },
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages,
    });

    let reply = completion.choices[0]?.message?.content ?? "";
    if (typeof reply !== "string") reply = JSON.stringify(reply);

    await bot.sendMessage(chatId, reply);

    // 6) сохраняем пару вопрос–ответ, НО только если это не команда
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

// === ROBOT-LAYER (скелет) ===

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

// Главный "тик" робота
async function robotTick() {
  try {
    const tasks = await getActiveRobotTasks();

    for (const t of tasks) {
      console.log(
        "🤖 ROBOT: нашёл задачу:",
        t.id,
        t.type,
        "schedule:",
        t.schedule
      );
      // Пока только лог. Логику добавим позже.
    }
  } catch (err) {
    console.error("❌ ROBOT ERROR:", err);
  }
}

// Запускаем робота раз в 30 секунд
setInterval(() => {
  robotTick();
}, 30_000);

console.log("🤖 AI Bot is running...");
