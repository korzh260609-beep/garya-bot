import TelegramBot from "node-telegram-bot-api";
import express from "express";
import OpenAI from "openai";
import pool from "./db.js"; // пока не используем, но подключен для памяти

// === Express сервер для Render ===
const app = express();
const PORT = process.env.PORT || 3000;

// чтобы Express умел читать JSON из вебхука Telegram
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

// простой маршрут для проверки Render
app.get("/", (req, res) => {
  res.send("GARYA AI Bot is alive! ⚡");
});

// маршрут, на который Telegram будет присылать апдейты
app.post(`/webhook/${token}`, (req, res) => {
  // Сразу говорим Telegram: "всё ок"
  res.sendStatus(200);

  // Логируем, что вообще пришло
  console.log("📩 Incoming webhook update:", JSON.stringify(req.body));

  try {
    bot.processUpdate(req.body);
  } catch (err) {
    console.error("❌ Error in bot.processUpdate:", err);
  }
});

app.listen(PORT, () => {
  console.log("🌐 Web server started on port: " + PORT);
});

// === OpenAI ===
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// === Обработка сообщений ===
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userText = msg.text || "";

  try {
    // Если OpenAI не настроен — простой ответ
    if (!process.env.OPENAI_API_KEY) {
      await bot.sendMessage(
        chatId,
        "Привет! 🐉 Бот Королевства GARYA работает на Render!"
      );
      return;
    }

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
