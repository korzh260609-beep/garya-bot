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
const answerModeByChat = new Map(); // chatId (строка) -> режим ответа

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

    if (roadmap?.content) parts.push(`ROADMAP:\n${roadmap.content}`);
    if (workflow?.content) parts.push(`WORKFLOW:\n${workflow.content}`);

    if (parts.length === 0) return "";

    const fullText = parts.join("\n\n");
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
  try {
    bot.processUpdate(req.body);
  } catch (err) {
    console.error("❌ Error in bot.processUpdate:", err);
  }
});

app.listen(PORT, () => {
  console.log("🌐 Web server started on port:", PORT);

  Sources.ensureDefaultSources()
    .then(() => console.log("📡 Sources: default templates are ready."))
    .catch((err) =>
      console.error("❌ Error initializing sources registry:", err)
    );
});

// === ФУНКЦИИ ПАМЯТИ (chat_memory) ===
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
    return [];
  }
}

async function saveMessageToMemory(chatId, role, content) {
  if (!content || !content.trim()) return;

  try {
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
    if (last && last.role === role && last.content === content) return;

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
    await saveMessageToMemory(chatId, "user", userText);
    await saveMessageToMemory(chatId, "assistant", assistantText);
  } catch (err) {
    console.error("❌ saveChatPair DB error:", err);
  }
}

// === USER PROFILE ===
async function ensureUserProfile(msg) {
  const chatId = msg.chat.id.toString();
  const nameFromTelegram = msg.from?.first_name || null;

  let role = "guest";
  let finalName = nameFromTelegram;

  if (chatId === "677128443") {
    role = "monarch";
    finalName = "GARY";
  }

  try {
    const existing = await pool.query("SELECT * FROM users WHERE chat_id = $1", [
      chatId,
    ]);

    if (existing.rows.length === 0) {
      await pool.query(
        `
        INSERT INTO users (chat_id, name, role, language)
        VALUES ($1, $2, $3, $4)
      `,
        [chatId, finalName, role, msg.from?.language_code || null]
      );
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

// === ОБРАБОТКА СООБЩЕНИЙ — НАЧАЛО ===
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = chatId.toString();

  const rawText = msg.text || "";
  const mediaSummary = describeMediaAttachments(msg);

  if (!rawText.trim() && !mediaSummary) return;

  let effectiveUserText = rawText || "";
  if (mediaSummary) {
    effectiveUserText =
      (effectiveUserText.trim().length === 0
        ? `Пользователь отправил вложение: ${mediaSummary}.`
        : effectiveUserText + `\n\n[Вложение: ${mediaSummary}]`);
  }

  try {
    // профиль
    await ensureUserProfile(msg);

    // === NEW: загрузка роли пользователя ===
    const userRes = await pool.query(
      "SELECT role FROM users WHERE chat_id = $1",
      [chatIdStr]
    );
    const role = userRes.rows[0]?.role || "guest";

      // сохраняем сообщение пользователя в память
    await saveMessageToMemory(chatIdStr, "user", effectiveUserText);

    // ————————————————————————————————————————————————
    // ОБРАБОТКА КОМАНД
    // ————————————————————————————————————————————————

    // === /mode (смена режима short/normal/long) ===
    if (rawText.startsWith("/mode")) {
      const parts = rawText.trim().split(/\s+/);
      const wanted = parts[1];

      if (!["short", "normal", "long"].includes(wanted)) {
        await bot.sendMessage(
          chatId,
          "Использование: /mode short | normal | long"
        );
        return;
      }

      setAnswerMode(chatIdStr, wanted);
      await bot.sendMessage(chatId, `Режим ответа установлен: ${wanted}`);
      return;
    }

    // === /pm_set (Project Memory SET) — только монарх ===
    if (rawText.startsWith("/pm_set")) {
      if (role !== "monarch") {
        await bot.sendMessage(chatId, "У вас нет прав для этой команды.");
        return;
      }

      const match = rawText.match(/^\/pm_set\s+(\S+)\s+([\s\S]+)/);
      if (!match) {
        await bot.sendMessage(
          chatId,
          "Использование:\n/pm_set <section> <text>"
        );
        return;
      }

      const section = match[1];
      const text = match[2];

      await upsertProjectSection(undefined, section, text);

      await bot.sendMessage(
        chatId,
        `Раздел "${section}" обновлён и сохранён в Project Memory.`
      );
      return;
    }

    // === /pm_show — просмотр Project Memory — монарх / гостям разрешено?
    // По ТЗ: доступ открыт, но можно ограничить — пока оставляем доступ для всех.
    if (rawText.startsWith("/pm_show")) {
      const section = rawText.split(/\s+/)[1];
      if (!section) {
        await bot.sendMessage(
          chatId,
          "Использование:\n/pm_show <section>\nПример: /pm_show roadmap"
        );
        return;
      }

      const sec = await getProjectSection(undefined, section);
      if (!sec || !sec.content) {
        await bot.sendMessage(chatId, `Раздел "${section}" пуст или не найден.`);
        return;
      }

      await bot.sendMessage(chatId, sec.content.slice(0, 4000));
      return;
    }

    // ————————————————————————————————————————————————
    // SOURCES: все команды должны быть ДОСТУПНЫ ТОЛЬКО МОНАРХУ
    // ————————————————————————————————————————————————

    // === /sources (список источников) ===
    if (rawText.startsWith("/sources")) {
      if (role !== "monarch") {
        await bot.sendMessage(chatId, "У вас нет прав для этой команды.");
        return;
      }

      const list = await Sources.listActiveSources();
      const lines = list.map(
        (s) =>
          `• <b>${s.source_key}</b> — ${s.type} (${s.enabled ? "ON" : "OFF"})`
      );

      await bot.sendMessage(chatId, lines.join("\n"), { parse_mode: "HTML" });
      return;
    }

    // === /test_source <key> ===
    if (rawText.startsWith("/test_source")) {
      if (role !== "monarch") {
        await bot.sendMessage(chatId, "У вас нет прав для этой команды.");
        return;
      }

      const parts = rawText.split(/\s+/);
      const key = parts[1];

      if (!key) {
        await bot.sendMessage(chatId, "Использование:\n/test_source <key>");
        return;
      }

      try {
        const result = await Sources.fetchFromSourceKey(key);
        await bot.sendMessage(
          chatId,
          `<b>Источник:</b> ${key}\n\n<pre>${JSON.stringify(
            result,
            null,
            2
          )}</pre>`,
          { parse_mode: "HTML" }
        );
      } catch (err) {
        await bot.sendMessage(
          chatId,
          `❌ Ошибка:\n<pre>${String(err)}</pre>`,
          { parse_mode: "HTML" }
        );
      }
      return;
    }

    // === /diag_source <key> ===
    if (rawText.startsWith("/diag_source")) {
      if (role !== "monarch") {
        await bot.sendMessage(chatId, "У вас нет прав для этой команды.");
        return;
      }

      const parts = rawText.split(/\s+/);
      const key = parts[1];

      if (!key) {
        await bot.sendMessage(chatId, "Использование:\n/diag_source <key>");
        return;
      }

      try {
        const info = await Sources.diagnoseSource(key);
        await bot.sendMessage(
          chatId,
          `<b>Диагностика:</b> ${key}\n\n<pre>${JSON.stringify(
            info,
            null,
            2
          )}</pre>`,
          { parse_mode: "HTML" }
        );
      } catch (err) {
        await bot.sendMessage(
          chatId,
          `❌ Ошибка диагностики:\n<pre>${String(err)}</pre>`,
          { parse_mode: "HTML" }
        );
      }
      return;
    }

    // === /sources_diag (полная диагностика всех источников) ===
    if (rawText.startsWith("/sources_diag")) {
      if (role !== "monarch") {
        await bot.sendMessage(chatId, "У вас нет прав для этой команды.");
        return;
      }

      try {
        const report = await Sources.runSourceDiagnosticsOnce();
        await bot.sendMessage(
          chatId,
          `<b>Диагностика всех источников:</b>\n\n<pre>${JSON.stringify(
            report,
            null,
            2
          )}</pre>`,
          { parse_mode: "HTML" }
        );
      } catch (err) {
        await bot.sendMessage(
          chatId,
          `❌ Ошибка диагностики:\n<pre>${String(err)}</pre>`,
          { parse_mode: "HTML" }
        );
      }
      return;
    }

    // === /source <key> (ручной fetch одного источника) ===
    if (rawText.startsWith("/source")) {
      if (role !== "monarch") {
        await bot.sendMessage(chatId, "У вас нет прав для этой команды.");
        return;
      }

      const parts = rawText.split(/\s+/);
      const key = parts[1];

      if (!key) {
        await bot.sendMessage(chatId, "Использование:\n/source <key>");
        return;
      }

      try {
        const data = await Sources.fetchFromSourceKey(key);
        await bot.sendMessage(
          chatId,
          `<b>Источник:</b> ${key}\n\n<pre>${JSON.stringify(
            data,
            null,
            2
          )}</pre>`,
          { parse_mode: "HTML" }
        );
      } catch (err) {
        await bot.sendMessage(
          chatId,
          `❌ Ошибка:\n<pre>${String(err)}</pre>`,
          { parse_mode: "HTML" }
        );
      }
      return;
    }

      // ————————————————————————————————————————————————
    // TASK ENGINE — базовые команды
    // ————————————————————————————————————————————————

    // === /tasks — список задач ===
    if (rawText.startsWith("/tasks")) {
      try {
        const res = await pool.query(
          `SELECT id, type, status, created_at FROM tasks ORDER BY id DESC LIMIT 20`
        );

        if (res.rows.length === 0) {
          await bot.sendMessage(chatId, "Задач пока нет.");
          return;
        }

        const lines = res.rows.map(
          (t) =>
            `#${t.id} — <b>${t.type}</b> — ${t.status} — ${new Date(
              t.created_at
            ).toLocaleString()}`
        );

        await bot.sendMessage(chatId, lines.join("\n"), {
          parse_mode: "HTML",
        });
      } catch (err) {
        await bot.sendMessage(chatId, "❌ Ошибка чтения задач.");
      }
      return;
    }

    // === /newtask <type> <payload> ===
    if (rawText.startsWith("/newtask")) {
      const match = rawText.match(/^\/newtask\s+(\S+)\s+([\s\S]+)/);
      if (!match) {
        await bot.sendMessage(
          chatId,
          "Использование:\n/newtask <type> <json>"
        );
        return;
      }

      const type = match[1];
      let payloadText = match[2];

      try {
        const payload = JSON.parse(payloadText);

        const res = await pool.query(
          `
          INSERT INTO tasks (type, payload, status)
          VALUES ($1, $2, 'pending')
          RETURNING id
        `,
          [type, payload]
        );

        await bot.sendMessage(
          chatId,
          `Задача #${res.rows[0].id} создана (type=${type}).`
        );
      } catch (err) {
        await bot.sendMessage(
          chatId,
          `Ошибка: неверный JSON или ошибка БД.\n<pre>${String(err)}</pre>`,
          { parse_mode: "HTML" }
        );
      }
      return;
    }

    // === /run <id> — вручную выполнить задачу ===
    if (rawText.startsWith("/run")) {
      const parts = rawText.trim().split(/\s+/);
      const id = Number(parts[1]);

      if (!id) {
        await bot.sendMessage(chatId, "Использование:\n/run <taskId>");
        return;
      }

      try {
        const taskRes = await pool.query("SELECT * FROM tasks WHERE id = $1", [
          id,
        ]);
        if (taskRes.rows.length === 0) {
          await bot.sendMessage(chatId, `Задача ${id} не найдена.`);
          return;
        }

        const t = taskRes.rows[0];

        await bot.sendMessage(
          chatId,
          `▶ Выполняю задачу #${id} (type=${t.type})...`
        );

        // DEMO EXECUTOR — будущий настоящий engine
        await pool.query(
          "UPDATE tasks SET status = 'done' WHERE id = $1",
          [id]
        );

        await bot.sendMessage(chatId, `Задача #${id} выполнена.`);
      } catch (err) {
        await bot.sendMessage(
          chatId,
          `❌ Ошибка:\n<pre>${String(err)}</pre>`,
          { parse_mode: "HTML" }
        );
      }
      return;
    }

    // ————————————————————————————————————————————————
    // Если это команда → она уже обработана выше
    // Остальное — обычный запрос к ИИ
    // ————————————————————————————————————————————————

    // === сбор истории для контекста ===
    const history = await getChatHistory(chatIdStr, MAX_HISTORY_MESSAGES);

    // === загрузка Project Memory (roadmap + workflow) ===
    const projectMemoryForContext = await loadProjectContext();

    // === режим ответов ===
    const answerMode = getAnswerMode(chatIdStr);

    // === системный промпт ===
    const systemPrompt = buildSystemPrompt({
      answerMode,
      projectMemoryForContext,
      userRole: role,
    });

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: effectiveUserText },
    ];

    let aiResponse = "";

    try {
      aiResponse = await callAI(messages, "high", answerMode);
    } catch (err) {
      console.error("❌ callAI error:", err);
      aiResponse = "⚠️ Ошибка обращения к ИИ.";
    }

    await bot.sendMessage(chatId, aiResponse);

    // сохраняем пару в память
    await saveChatPair(chatIdStr, effectiveUserText, aiResponse);

  } catch (err) {
    console.error("❌ MAIN handler error:", err);
    await bot.sendMessage(chatId, "⚠️ Ошибка обработки сообщения.");
  }
});

// ————————————————————————————————————————————————
// ОПИСАНИЕ ВЛОЖЕНИЙ (фото/документы/видео/голос)
// ————————————————————————————————————————————————
function describeMediaAttachments(msg) {
  if (msg.photo) return "фото";
  if (msg.document) return `документ: ${msg.document.file_name || "без имени"}`;
  if (msg.audio) return "аудио";
  if (msg.voice) return "голосовое сообщение";
  if (msg.video) return "видео";
  return null;
}

// ————————————————————————————————————————————————
// ЛОГИРОВАНИЕ ВЗАИМОДЕЙСТВИЙ
// ————————————————————————————————————————————————
async function logInteraction(chatId, userText, aiText) {
  try {
    await pool.query(
      `
      INSERT INTO interaction_logs (chat_id, user_text, ai_text)
      VALUES ($1, $2, $3)
    `,
      [chatId, userText || null, aiText || null]
    );
  } catch (err) {
    console.error("❌ logInteraction DB error:", err);
  }
}

// ————————————————————————————————————————————————
// ЭКСПОРТ EXPRESS SERVER (для Render/hosting)
// ————————————————————————————————————————————————
export default app;
