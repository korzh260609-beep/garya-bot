// ============================================================================
// === INDEX — ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ, СЕРВЕР, ВЕБХУК, КОМАНДЫ, AI ===
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
  // updateTaskStatus, // пока не используем
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

// === AI ===
import { callAI } from "./ai.js";

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
// === ОБРАБОТКА ВСЕХ СООБЩЕНИЙ: КОМАНДЫ + ЧАТ + AI ===
// ============================================================================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = chatId.toString();

  // 1) Профиль пользователя
  await ensureUserProfile(msg);

  const text = msg.text || "";
  const trimmed = text.trim();

  // --- FILE-INTAKE: определяем вложения ---
  const media = summarizeMediaAttachment(msg);

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

      // --------------------------- Статистика пользователей --------------
      case "/users_stats": {
        const isMonarch = chatIdStr === "677128443";
        if (!isMonarch) {
          await bot.sendMessage(
            chatId,
            "Эта команда доступна только монарху GARYA."
          );
          return;
        }

        try {
          const totalRes = await pool.query(
            "SELECT COUNT(*)::int AS total FROM users"
          );
          const total = totalRes.rows[0]?.total ?? 0;

          const byRoleRes = await pool.query(
            `
              SELECT COALESCE(role, 'unknown') AS role,
                     COUNT(*)::int AS count
              FROM users
              GROUP BY COALESCE(role, 'unknown')
              ORDER BY role
            `
          );

          let out = "👥 Статистика пользователей СГ\n\n";
          out += `Всего пользователей: ${total}\n\n`;

          if (byRoleRes.rows.length) {
            out += "По ролям:\n";
            for (const r of byRoleRes.rows) {
              out += `• ${r.role}: ${r.count}\n`;
            }
          }

          await bot.sendMessage(chatId, out);
        } catch (e) {
          console.error("❌ Error in /users_stats:", e);
          await bot.sendMessage(
            chatId,
            "Не удалось получить статистику пользователей."
          );
        }
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

        let out = "📋 Ваши задачи:\n\n";
        for (const t of tasks) {
          out += `#${t.id} — ${t.title}\nТип: ${t.type}\nСтатус: ${t.status}\n\n`;
        }

        await bot.sendMessage(chatId, out);
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

        const textDiag =
          `🩺 Диагностика источников\n` +
          `Всего: ${summary.total}\n` +
          `OK: ${summary.okCount}\n` +
          `Ошибок: ${summary.failCount}`;

        await bot.sendMessage(chatId, textDiag);
        return;
      }

      case "/source": {
        const key = args.trim();
        if (!key) {
          await bot.sendMessage(chatId, "Использование: /source <key>");
          return;
        }

        const result = await fetchFromSourceKey(key);
        await bot.sendMessage(
          chatId,
          JSON.stringify(result, null, 2).slice(0, 900)
        );
        return;
      }

      // --------------------------- PROJECT MEMORY -------------------------
      case "/pm_show": {
        const section = args.trim();
        if (!section) {
          await bot.sendMessage(chatId, "Использование: /pm_show <section>");
          return;
        }

        const rec = await pool.query(
          "SELECT section, content, updated_at FROM project_memory WHERE section = $1 LIMIT 1",
          [section]
        );

        if (!rec.rows.length) {
          await bot.sendMessage(chatId, `Секция "${section}" отсутствует.`);
          return;
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
          await bot.sendMessage(
            chatId,
            "Только монарх может менять Project Memory."
          );
          return;
        }

        const firstSpace = args.indexOf(" ");
        if (firstSpace === -1) {
          await bot.sendMessage(
            chatId,
            "Использование: /pm_set <section> <text>"
          );
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
        // неизвестная команда — пойдёт дальше как обычный текст к ИИ
        break;
    }
  }

  // ========================================================================
  // === НЕ КОМАНДЫ: ПАМЯТЬ + PROJECT CONTEXT + ВЫЗОВ ИИ ===
  // ========================================================================

  const mediaText = media ? `Вложение: ${media}` : "";
  let effective = trimmed || mediaText;
  if (trimmed && mediaText) {
    effective = `${trimmed}\n\n(${mediaText})`;
  }

  // 1) сохраняем сообщение в память
  await saveMessageToMemory(chatIdStr, "user", effective);

  // 2) читаем историю
  const history = await getChatHistory(chatIdStr, MAX_HISTORY_MESSAGES);

  // 3) классификация (пока простая заглушка)
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
    { role: "user", content: effective },
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
      temperature,
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

