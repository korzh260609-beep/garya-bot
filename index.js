import TelegramBot from "node-telegram-bot-api";
import express from "express";
import OpenAI from "openai";
import pkg from "pg"; // <-- PostgreSQL

const { Pool } = pkg;

// === PostgreSQL: подключение и инициализация ===
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // для Render PostgreSQL
  },
});

async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_memory (
        id SERIAL PRIMARY KEY,
        chat_id BIGINT NOT NULL,
        role TEXT NOT NULL,          -- 'user' или 'assistant'
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log("🗄️  Database ready: chat_memory table is OK");
  } catch (err) {
    console.error("❌ DB init error:", err);
  }
}

initDb();

// === Express сервер для Render ===
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("GARYA AI Bot is alive! ⚡");
});

app.listen(PORT, () => {
  console.log("🌐 Web server started on port: " + PORT);
});

// === Telegram Bot ===
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN is missing!");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// === OpenAI ===
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// === Обработка сообщений ===
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userText = msg.text || "";

  try {
    // Если OpenAI не настроен — fallback
    if (!process.env.OPENAI_API_KEY) {
      await bot.sendMessage(
        chatId,
        "Привет! 🐉 Бот Королевства GARYA работает на Render!"
      );
      return;
    }

    // Пока память НЕ используем — только проверяем, что всё работает.
    // Позже добавим чтение/запись в chat_memory.

    // Отправляем запрос в OpenAI
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Ты — Советник Королевства GARYA. Говори дружелюбно и коротко.",
        },
        {
          role: "user",
          content: userText,
        },
      ],
    });

    const reply = completion.choices[0].message.content;

    await bot.sendMessage(chatId, reply);
  } catch (err) {
    console.error("OpenAI error:", err);
    await bot.sendMessage(
      chatId,
      "🐉 Бот GARYA онлайн, но ИИ сейчас недоступен."
    );
  }
});

console.log("🤖 AI Bot is running...");
