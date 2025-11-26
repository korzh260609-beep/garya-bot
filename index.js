import TelegramBot from "node-telegram-bot-api";
import express from "express";
import OpenAI from "openai";
import pool from "./db.js"; // память + профили

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

  // роль и имя по умолчанию
  let role = "guest";
  let finalName = nameFromTelegram;

  // === МОНАРХ (ты) ===
  if (chatId === "677128443") {
    role = "monarch";
    finalName = "GARY";  // <-- фиксируем имя
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
        [
          chatId,
          finalName,
          role,
          msg.from?.language_code || null,
        ]
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

// === ОБРАБОТКА СООБЩЕНИЙ ===
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = msg.chat.id.toString();
  const userText = msg.text || "";

  if (!userText.trim()) return;

  try {
    // создаём/обновляем профиль
    await ensureUserProfile(msg);

    if (!process.env.OPENAI_API_KEY) {
      await bot.sendMessage(
        chatId,
        "Привет! 🐉 Бот Королевства GARYA работает на Render!"
      );
      return;
    }

    const history = await getChatHistory(chatIdStr, 20);

    const messages = [
      {
        role: "system",
        content:
          "Ты — Советник Королевства GARYA. Ты обязан знать, что монарха зовут GARY. Обращайся уважительно.",
      },
      ...history,
      {
        role: "user",
        content: userText,
      },
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    let reply = completion.choices[0]?.message?.content ?? "";
    if (typeof reply !== "string") reply = JSON.stringify(reply);

    await bot.sendMessage(chatId, reply);

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
