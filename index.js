import TelegramBot from "node-telegram-bot-api";
import express from "express";
import OpenAI from "openai";
import pool from "./db.js"; // используем для памяти

// === Express сервер для Render ===
const app = express();
const PORT = process.env.PORT || 3000;

// Чтобы Express умел читать JSON из вебхука Telegram
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

// Корневой маршрут для проверки
app.get("/", (req, res) => {
  res.send("GARYA AI Bot is alive! ⚡");
});

// Маршрут вебхука (POST) — сюда шлёт Telegram
app.post(`/webhook/${token}`, (req, res) => {
  // Сразу отвечаем Telegram, чтобы не было 520
  res.sendStatus(200);

  console.log("📩 Incoming webhook update:", JSON.stringify(req.body));

  try {
    bot.processUpdate(req.body);
  } catch (err) {
    console.error("❌ Error in bot.processUpdate:", err);
  }
});

// Доп. GET-маршрут для ручной проверки вебхука через браузер
app.get(`/webhook/${token}`, (req, res) => {
  console.log("🔎 GET webhook ping");
  res.send("OK");
});

// Запускаем HTTP-сервер
app.listen(PORT, () => {
  console.log("🌐 Web server started on port: " + PORT);
});

// === OpenAI ===
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// === Вспомогательные функции памяти ===

// Достать последние сообщения чата из БД
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

  // Разворачиваем порядок: от старых к новым
  return result.rows.reverse().map((row) => ({
    role: row.role,
    content: row.content,
  }));
}

// Сохранить пару "пользователь → ассистент" в БД
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

// === Обработка сообщений Telegram ===
bot.on("message", async (msg) => {
  const chatId = msg.chat.id.toString();
  const userText = msg.text || "";

  // Пустые сообщения не обрабатываем
  if (!userText.trim()) {
    return;
  }

  try {
    // Если ключ OpenAI не задан — простой ответ
    if (!process.env.OPENAI_API_KEY) {
      await bot.sendMessage(
        chatId,
        "Привет! 🐉 Бот Королевства GARYA работает на Render!"
      );
      return;
    }

    // 1. Забираем историю чата из БД
    const history = await getChatHistory(chatId, 20);

    // 2. Формируем сообщения для модели: system + история + новый вопрос
    const messages = [
      {
        role: "system",
        content:
          "Ты — Советник Королевства GARYA. Говори дружелюбно и коротко.",
      },
      ...history,
      {
        role: "user",
        content: userText,
      },
    ];

    // 3. Запрос к OpenAI с учётом истории
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    let reply = completion.choices[0]?.message?.content ?? "";

    if (typeof reply !== "string") {
      reply = JSON.stringify(reply);
    }

    // 4. Отправляем ответ пользователю
    await bot.sendMessage(chatId, reply);

    // 5. Сохраняем в память и вопрос, и ответ
    await saveChatPair(chatId, userText, reply);
  } catch (err) {
    console.error("OpenAI error:", err);
    await bot.sendMessage(
      chatId,
      "🐉 Бот GARYA онлайн, но ИИ сейчас недоступен."
    );
  }
});

console.log("🤖 AI Bot is running...");
