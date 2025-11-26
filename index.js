import TelegramBot from "node-telegram-bot-api";
import express from "express";
import OpenAI from "openai";
import pool from "./db.js"; // память + профили + tasks

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
async function getChatHistory(chatId, limit = 20) {
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
}

async function saveChatPair(chatId, userText, assistantText) {
  await pool.query(
    `
      INSERT INTO chat_memory (chat_id, role, content)
      VALUES
        ($1, 'user', $2),
        ($1, 'assistant', $3)
    `,
    [chatId, userText, assistantText]
  );
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
  // заголовок — первые 60 символов текста
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

// === ОБРАБОТКА СООБЩЕНИЙ ===
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = msg.chat.id.toString();
  const userText = msg.text || "";

  if (!userText.trim()) return;

  try {
    // 1) профиль
    await ensureUserProfile(msg);

    // 2) /profile, /whoami, /me
    if (
      userText === "/profile" ||
      userText === "/whoami" ||
      userText === "/me"
    ) {
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

    // 3) /addtask_test — создаём демо-задачу
    if (userText === "/addtask_test") {
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

    // 3.1) /newtask <текст> — создаём обычную задачу
    if (userText.startsWith("/newtask")) {
      const match = userText.match(/^\/newtask\s+(.+)/);

      if (!match) {
        await bot.sendMessage(
          chatId,
          "Использование:\n`/newtask описание задачи`\n\nНапример:\n`/newtask следи за ценой BTC раз в час`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const taskText = match[1].trim();

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

    // 4) /tasks — список задач
    if (userText === "/tasks") {
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

    // 5) если нет ключа OpenAI — простой ответ
    if (!process.env.OPENAI_API_KEY) {
      await bot.sendMessage(
        chatId,
        "Привет! 🐉 Бот Королевства GARYA работает на Render!"
      );
      return;
    }

    // 6) история + системный промпт
    const history = await getChatHistory(chatIdStr, 20);

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
      model: "gpt-4o-mini",
      messages,
    });

    let reply = completion.choices[0]?.message?.content ?? "";
    if (typeof reply !== "string") reply = JSON.stringify(reply);

    await bot.sendMessage(chatId, reply);

    // 7) сохраняем пару вопрос-ответ
    await saveChatPair(chatIdStr, userText, reply);
  } catch (err) {
    console.error("OpenAI error:", err);
    await bot.sendMessage(
      chatId,
      "🐉 Бот GARYA онлайн, но ИИ сейчас недоступен."
    );
  }
});

console.log("🤖 AI Bot is running...");
