import TelegramBot from "node-telegram-bot-api";
import express from "express";
import OpenAI from "openai";
import pkg from "pg"; // PostgreSQL

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

// === Функции работы с памятью ===
async function saveMessage(chatId, role, content) {
  try {
    await pool.query(
      "INSERT INTO chat_memory (chat_id, role, content) VALUES ($1, $2, $3)",
      [chatId, role, content]
    );
  } catch (err) {
    console.error("❌ DB save error:", err);
  }
}

async function loadRecentMessages(chatId, limit = 20) {
  try {
    const res = await pool.query(
      `
      SELECT role, content
      FROM chat_memory
      WHERE chat_id = $1
      ORDER BY created_at ASC
      LIMIT $2
    `,
      [chatId, limit]
    );

    return res.rows; // [{ role, content }, ...]
  } catch (err) {
    console.error("❌ DB load error:", err);
    return [];
  }
}

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
  if (!msg.text) return; // работаем только с текстом

  const chatId = msg.chat.id;
  const userText = msg.text.trim();

  // Отладочная команда: показать память
  if (userText === "/memory") {
    try {
      const history = await loadRecentMessages(chatId, 20);
      if (history.length === 0) {
        await bot.sendMessage(chatId, "Память пуста для этого чата.");
        return;
      }

      const formatted = history
        .map(
          (row, idx) =>
            `${idx + 1}. [${row.role}] ${row.content.slice(0, 120)}`
        )
        .join("\n\n");

      await bot.sendMessage(
        chatId,
        "🧠 Последние записи памяти:\n\n" + formatted
      );
    } catch (err) {
      console.error("❌ /memory error:", err);
      await bot.sendMessage(chatId, "Ошибка при чтении памяти.");
    }
    return;
  }

  try {
    // Если OpenAI не настроен — простой ответ без ИИ
    if (!process.env.OPENAI_API_KEY) {
      await bot.sendMessage(
        chatId,
        "Привет! 🐉 Бот Королевства GARYA работает на Render, но ИИ сейчас не подключён."
      );
      return;
    }

    // Сохраняем сообщение пользователя
    await saveMessage(chatId, "user", userText);

    // Загружаем историю (уже включая свежий текст)
    const history = await loadRecentMessages(chatId, 20);

    // Формируем контекст для модели
    const messages = [
      {
        role: "system",
        content:
          "Ты — Советник Королевства GARYA. Разговариваешь с монархом по имени Гарик (GARY). " +
          "Если собеседник говорит 'запомни' или сообщает факты о себе (имя, роль, интересы), " +
          "ты обязан использовать эти факты в следующих ответах и считать их актуальными, " +
          "пока он явно не скажет, что они изменились. Отвечай дружелюбно, по делу и критично.",
      },
      ...history.map((row) => ({
        role: row.role,
        content: row.content,
      })),
    ];

    // Запрос в OpenAI
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    const reply = completion.choices[0].message.content;

    // Сохраняем ответ ассистента в память
    await saveMessage(chatId, "assistant", reply);

    // Отправляем ответ в Telegram
    await bot.sendMessage(chatId, reply);
  } catch (err) {
    console.error("OpenAI error:", err);
    await bot.sendMessage(
      chatId,
      "🐉 Бот GARYA онлайн, но ИИ сейчас временно недоступен."
    );
  }
});

console.log("🤖 AI Bot is running...");
