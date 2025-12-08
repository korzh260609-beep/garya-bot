// ============================================================================
// === INDEX: ЧАСТЬ 1 / 3 — ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ, СЕРВЕР, ВЕБХУКИ ===
// ============================================================================

// === БАЗОВЫЕ ИМПОРТЫ ===
import express from "express";
import TelegramBot from "node-telegram-bot-api";

// === CORE ===
import { getAnswerMode, setAnswerMode } from "./core/answerMode.js";
import { loadProjectContext } from "./core/projectContext.js";

// === MEMORY ===
import {
  getChatHistory,
  saveMessageToMemory,
  saveChatPair,
} from "./memory/chatMemory.js";

// === USERS ===
import { ensureUserProfile } from "./users/userProfile.js";

// === TASK ENGINE ===
import {
  createDemoTask,
  createManualTask,
  createTestPriceMonitorTask,
  getUserTasks,
  getTaskById,
  updateTaskStatus,
  runTaskWithAI,
} from "./tasks/taskEngine.js";

// === SOURCES LAYER ===
import {
  ensureDefaultSources,
  runSourceDiagnosticsOnce,
  getAllSourcesSafe,
  fetchFromSourceKey,
  formatSourcesList,
} from "./sources/sourcesDebug.js";

// === FILE-INTAKE / MEDIA ===
import { summarizeMediaAttachment } from "./media/fileIntake.js";

// === LOGGING ===
import { logInteraction } from "./logging/interactionLogs.js";

// === ROBOT MOCK-LAYER ===
import { startRobotLoop } from "./robot/robotMock.js";

// === DB ===
import pool from "./db.js";

// === CONSTANTS ===
const MAX_HISTORY_MESSAGES = 20;

// ============================================================================
// === EXPRESS SERVER ===
// ============================================================================
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ============================================================================
// === TELEGRAM BOT И ВЕБХУК ===
// ============================================================================
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN отсутствует!");
  process.exit(1);
}

const bot = new TelegramBot(token);
const WEBHOOK_URL = `https://garya-bot.onrender.com/webhook/${token}`;
bot.setWebHook(WEBHOOK_URL);

app.get("/", (req, res) => res.send("GARYA AI Bot работает ⚡"));

app.post(`/webhook/${token}`, (req, res) => {
  res.sendStatus(200);
  try {
    bot.processUpdate(req.body);
  } catch (err) {
    console.error("❌ bot.processUpdate error:", err);
  }
});

// ============================================================================
// === ЗАПУСК СЕРВЕРА И ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ ===
// ============================================================================
app.listen(PORT, async () => {
  console.log("🌐 HTTP-сервер запущен на порту:", PORT);

  try {
    // 1) Sources registry
    await ensureDefaultSources();
    console.log("📡 Sources registry готов.");

    // 2) Robot Layer
    startRobotLoop(bot);
    console.log("🤖 ROBOT mock-layer запущен.");

  } catch (e) {
    console.error("❌ ERROR при инициализации:", e);
  }
});

// ============================================================================
// === INDEX: ЧАСТЬ 2 / 3 — ОБРАБОТКА КОМАНД (/profile, /tasks, /sources, ...) ===
// ============================================================================

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = chatId.toString();

  // 1) Профиль пользователя
  await ensureUserProfile(msg);

  const text = msg.text || "";
  const trimmed = text.trim();

  // --- FILE-INTAKE: определяем вложения ---
  const mediaSummary = summarizeMediaAttachment(msg);

  // ========================================================================
  // === ОБРАБОТКА КОМАНД (все, что начинается с "/") ===
  // ========================================================================
  if (trimmed.startsWith("/")) {
    const args = trimmed.split(" ").slice(1).join(" ");
    const cmd = trimmed.split(" ")[0];

    switch (cmd) {
      // --------------------------- Профиль -------------------------------
      case "/profile":
      case "/me":
      case "/whoami": {
        const res = await pool.query(
          "SELECT chat_id, name, role, language, created_at FROM users WHERE chat_id = $1",
          [chatIdStr]
        );
        if (res.rows.length === 0) {
          await bot.sendMessage(chatId, "Профиль не найден.");
          return;
        }

        const u = res.rows[0];
        await bot.sendMessage(
          chatId,
          `🧾 Профиль\nID: ${u.chat_id}\nИмя: ${u.name}\nРоль: ${u.role}\nСоздан: ${u.created_at}`
        );
        return;
      }

      // --------------------------- ДЕМО-ЗАДАЧА ---------------------------
      case "/demo_task": {
        const id = await createDemoTask(chatIdStr);
        await bot.sendMessage(
          chatId,
          `✅ Демо-задача создана!\nID: ${id}`
        );
        return;
      }

      // ----------------------- ТЕСТОВЫЙ BTC-МОНТОРИНГ ---------------------
      case "/btc_test_task": {
        const task = await createTestPriceMonitorTask(chatIdStr);
        await bot.sendMessage(
          chatId,
          `🆕 Тест price_monitor создан!\nID: ${task.id}\nРасписание: ${task.schedule}`
        );
        return;
      }

      // --------------------------- СОЗДАТЬ НОВУЮ ЗАДАЧУ -------------------
      case "/newtask": {
        if (!args.trim()) {
          await bot.sendMessage(chatId, "Использование: /newtask <описание>");
          return;
        }

        const task = await createManualTask(chatIdStr, args.trim());
        await bot.sendMessage(chatId, `🆕 Задача создана!\n#${task.id}`);
        return;
      }

      // --------------------------- ЗАПУСК ЗАДАЧИ -------------------------
      case "/run": {
        const id = Number(args.trim());
        if (!id) {
          await bot.sendMessage(chatId, "Использование: /run <id>");
          return;
        }

        const task = await getTaskById(chatIdStr, id);
        if (!task) {
          await bot.sendMessage(chatId, "Задача не найдена.");
          return;
        }

        await bot.sendMessage(chatId, `Запуск задачи #${task.id}...`);
        await runTaskWithAI(task, chatId);
        return;
      }

      // --------------------------- СПИСОК ЗАДАЧ --------------------------
      case "/tasks": {
        const tasks = await getUserTasks(chatIdStr, 30);

        if (!tasks.length) {
          await bot.sendMessage(chatId, "У вас нет задач.");
          return;
        }

        let text = "📋 Ваши задачи:\n\n";
        for (const t of tasks) {
          text += `#${t.id} — ${t.title}\nТип: ${t.type}\nСтатус: ${t.status}\n\n`;
        }

        await bot.sendMessage(chatId, text);
        return;
      }

      // --------------------------- РАБОТА С ИСТОЧНИКАМИ -------------------
      case "/sources": {
        const sources = await getAllSourcesSafe();
        const out = formatSourcesList(sources);
        await bot.sendMessage(chatId, out, { parse_mode: "HTML" });
        return;
      }

      case "/sources_diag": {
        const summary = await runSourceDiagnosticsOnce();

        const text =
          `🩺 Диагностика\nВсего: ${summary.total}\nOK: ${summary.okCount}\nОшибок: ${summary.failCount}`;
        await bot.sendMessage(chatId, text);
        return;
      }

      case "/source": {
        const key = args.trim();
        if (!key) {
          await bot.sendMessage(chatId, "Использование: /source <key>");
          return;
        }

        const result = await fetchFromSourceKey(key);
        await bot.sendMessage(chatId, JSON.stringify(result, null, 2).slice(0, 900));
        return;
      }

      // --------------------------- PROJECT MEMORY -------------------------
      case "/pm_show": {
        const section = args.trim();
        if (!section) return bot.sendMessage(chatId, "Использование: /pm_show <section>");

        const rec = await pool.query(
          "SELECT section, content, updated_at FROM project_memory WHERE section = $1 LIMIT 1",
          [section]
        );

        if (!rec.rows.length) {
          return bot.sendMessage(chatId, `Секция "${section}" отсутствует.`);
        }

        const r = rec.rows[0];
        await bot.sendMessage(
          chatId,
          `🧠 Project Memory: ${r.section}\n\n${r.content.slice(0, 3500)}`
        );
        return;
      }

      case "/pm_set": {
        if (chatIdStr !== "677128443") {
          await bot.sendMessage(chatId, "Только монарх может менять Project Memory.");
          return;
        }

        const firstSpace = args.indexOf(" ");
        if (firstSpace === -1) {
          await bot.sendMessage(chatId, "Использование: /pm_set <section> <text>");
          return;
        }

        const section = args.slice(0, firstSpace).trim();
        const content = args.slice(firstSpace + 1).trim();

        await pool.query(
          `
            INSERT INTO project_memory (section, content)
            VALUES ($1, $2)
            ON CONFLICT (section)
            DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
          `,
          [section, content]
        );

        await bot.sendMessage(chatId, `Обновлено: ${section}`);
        return;
      }

      // --------------------------- РЕЖИМЫ ОТВЕТОВ -------------------------
      case "/mode": {
        const mode = args.trim().toLowerCase();
        const valid = ["short", "normal", "long"];

        if (!valid.includes(mode)) {
          await bot.sendMessage(chatId, "Режимы: short / normal / long");
          return;
        }

        setAnswerMode(chatIdStr, mode);
        await bot.sendMessage(chatId, `Режим ответа: ${mode}`);
        return;
      }

      // --------------------------------------------------------------------
      default:
        // неизвестная команда — передаём дальше как обычный текст
        break;
    }
  }

// ============================================================================
// === INDEX: ЧАСТЬ 3 / 3 — НЕ-КОМАНДНЫЕ СООБЩЕНИЯ, MEMORY, AI ===
// ============================================================================

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = chatId.toString();

  // Повторная проверка профиля (безопасность)
  await ensureUserProfile(msg);

  const text = msg.text || "";
  const trimmed = text.trim();

  const media = summarizeMediaAttachment(msg);

  // Формируем итоговый текст
  let effective = trimmed;
  if (media) {
    if (!effective) effective = `Вложение: ${media}`;
    else effective += `\n\n(Также: ${media})`;
  }

  // 1) сохраняем сообщение в память
  await saveMessageToMemory(chatIdStr, "user", effective);

  // 2) читаем историю
  const history = await getChatHistory(chatIdStr, MAX_HISTORY_MESSAGES);

  // 3) классификация (простая)
  const classification = {
    taskType: "chat",
    aiCostLevel: "low",
  };

  await logInteraction(chatIdStr, classification);

  // 4) Project Context (ROADMAP + WORKFLOW)
  const projectCtx = await loadProjectContext();

  // 5) System Prompt
  const answerMode = getAnswerMode(chatIdStr);

  const systemPrompt =
    `Ты — Советник GARYA.\n` +
    `Режим ответа: ${answerMode}.\n\n` +
    (projectCtx ? projectCtx + "\n\n" : "") +
    `Будь краток, точен, следуй ТЗ.`;


  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: effective }
  ];

  // 6) настройки вывода по режиму
  let maxTokens = 350;
  let temperature = 0.6;

  if (answerMode === "short") {
    maxTokens = 150;
    temperature = 0.3;
  } else if (answerMode === "long") {
    maxTokens = 900;
    temperature = 0.8;
  }

  // 7) Вызов ИИ
  let aiReply = "";
  try {
    aiReply = await callAI(messages, classification.aiCostLevel, {
      max_output_tokens: maxTokens,
      temperature
    });
  } catch (e) {
    console.error("❌ AI error:", e);
    aiReply = "⚠️ Ошибка вызова ИИ.";
  }

  // 8) сохраняем pair
  await saveChatPair(chatIdStr, effective, aiReply);

  // 9) отправляем ответ пользователю
  try {
    await bot.sendMessage(chatId, aiReply);
  } catch (e) {
    console.error("❌ Telegram send error:", e);
  }
});

// ============================================================================
console.log("🤖 GARYA AI Bot (modular index.js) работает…");
