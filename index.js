import TelegramBot from "node-telegram-bot-api";
import express from "express";

// === Express сервер для Render ===
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("GARYA Bot is alive! ⚡");
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

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Привет! 🐉 Бот Королевства GARYA работает на Render!");
});

console.log("🤖 Telegram Bot is running...");
