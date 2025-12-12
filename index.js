// ============================================================================
// === index.js — SG (Советник GARYA) : Express + Telegram Webhook + Commands ===
// ============================================================================

import express from "express";
import TelegramBot from "node-telegram-bot-api";

// === CORE ===
import { getAnswerMode, setAnswerMode } from "./core/answerMode.js";
import { loadProjectContext } from "./core/projectContext.js";

// === SYSTEM PROMPT ===
import { buildSystemPrompt } from "./systemPrompt.js";

// === MEMORY ===
import {
  getChatHistory,
  saveMessageToMemory,
  saveChatPair,
} from "./src/memory/chatMemory.js";

// === USERS ===
import { ensureUserProfile } from "./src/users/userProfile.js";

// === TASK ENGINE ===
import {
  createDemoTask,
  createManualTask,
  createTestPriceMonitorTask,
  getUserTasks,
  getTaskById,
  runTaskWithAI,
} from "./src/tasks/taskEngine.js";

// === SOURCES LAYER ===
import {
  ensureDefaultSources,
  runSourceDiagnosticsOnce,
  getAllSourcesSafe,
  fetchFromSourceKey,
  formatSourcesList,
  diagnoseSource,
} from "./src/sources/sources.js";

// === COINGECKO (V1 SIMPLE PRICE) ===
import {
  getCoinGeckoSimplePriceById,
  getCoinGeckoSimplePriceMulti,
} from "./src/sources/coingecko/index.js";

// === FILE-INTAKE / MEDIA ===
import {
  summarizeMediaAttachment,
  intakeAndDownloadIfNeeded,
} from "./src/media/fileIntake.js";

// === LOGGING ===
import { logInteraction } from "./src/logging/interactionLogs.js";

// === ROBOT MOCK-LAYER ===
import { startRobotLoop } from "./src/robot/robotMock.js";

// === AI ===
import { callAI } from "./ai.js";

// === PROJECT MEMORY (DB-backed, но управляем через команды) ===
import { getProjectSection, upsertProjectSection } from "./projectMemory.js";

// === DB ===
import pool from "./db.js";

// ============================================================================
// === CONSTANTS / CONFIG ===
// ============================================================================
const MAX_HISTORY_MESSAGES = 20;

// ВАЖНО: монарх определяется ТОЛЬКО по chat_id (Telegram user id).
// Можно переопределить в Render Environment: MONARCH_CHAT_ID
const MONARCH_CHAT_ID = (process.env.MONARCH_CHAT_ID || "677128443").toString();

// Планы пока не включены, но поле оставляем для permissions
const DEFAULT_PLAN = "free";

// ============================================================================
// === HELPERS ===
// ============================================================================
function isMonarch(chatIdStr) {
  return chatIdStr === MONARCH_CHAT_ID;
}

/**
 * Парсер команд Telegram:
 * - cmd: "/pm_set"
 * - rest: "roadmap\n...." (сохраняем переносы строк)
 */
function parseCommand(text) {
  if (!text) return null;
  const m = text.match(/^\/(\S+)(?:\s+([\s\S]+))?$/);
  if (!m) return null;
  return { cmd: `/${m[1]}`, rest: (m[2] || "").trim() };
}

function firstWordAndRest(rest) {
  if (!rest) return { first: "", tail: "" };
  const m = rest.match(/^(\S+)(?:\s+([\s\S]+))?$/);
  return { first: (m?.[1] || "").trim(), tail: (m?.[2] || "").trim() };
}

/**
 * Само-миграция Project Memory: создаём таблицу, если она отсутствует.
 */
async function ensureProjectMemoryTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_memory (
      id BIGSERIAL PRIMARY KEY,
      project_key TEXT NOT NULL,
      section TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      schema_version INT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_project_memory_key_section_created
    ON project_memory (project_key, section, created_at);
  `);
}

// ============================================================================
// === EXPRESS SERVER ===
// ============================================================================
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

// ============================================================================
// === TELEGRAM BOT + WEBHOOK ===
// ============================================================================
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN отсутствует!");
  process.exit(1);
}

const bot = new TelegramBot(token);
const WEBHOOK_URL = `${
  process.env.WEBHOOK_URL || "https://garya-bot.onrender.com"
}/webhook/${token}`;

bot.setWebHook(WEBHOOK_URL);

app.get("/", (req, res) => res.send("SG (GARYA AI Bot) работает ⚡"));

app.post(`/webhook/${token}`, (req, res) => {
  res.sendStatus(200);
  try {
    bot.processUpdate(req.body);
  } catch (err) {
    console.error("❌ bot.processUpdate error:", err);
  }
});

// ============================================================================
// === START SERVER + INIT SYSTEM ===
// ============================================================================
app.listen(PORT, async () => {
  console.log("🌐 HTTP-сервер запущен на порту:", PORT);

  try {
    // 0) Project Memory table (auto)
    await ensureProjectMemoryTable();
    console.log("🧠 Project Memory table OK.");

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
// === MAIN HANDLER: COMMANDS + CHAT + AI ===
// ============================================================================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = chatId.toString();

  const text = msg.text || "";
  const trimmed = text.trim();

  // 0) User profile
  await ensureUserProfile(msg);

  // 1) role + plan
  let userRole = "guest";
  let userPlan = DEFAULT_PLAN;

  try {
    const uRes = await pool.query("SELECT role FROM users WHERE chat_id = $1", [
      chatIdStr,
    ]);
    if (uRes.rows.length) userRole = uRes.rows[0].role || "guest";
  } catch (e) {
    console.error("❌ Error fetching user role:", e);
  }

  const bypass = isMonarch(chatIdStr);

  // access object (единый)
  const access = {
    userRole,
    userPlan,
    bypassPermissions: bypass,
  };

  // 2) FILE-INTAKE (summary)
  const mediaSummary = summarizeMediaAttachment(msg);

  // ========================================================================
  // === COMMANDS ===
  // ========================================================================
  if (trimmed.startsWith("/")) {
    const parsed = parseCommand(trimmed);
    const cmd = parsed?.cmd || trimmed.split(" ")[0];
    const rest = parsed?.rest || "";

    switch (cmd) {
      // --------------------------- PROFILE -------------------------------
      case "/profile":
      case "/me":
      case "/whoami": {
        const res = await pool.query(
          "SELECT chat_id, name, role, language, created_at FROM users WHERE chat_id = $1",
          [chatIdStr]
        );

        if (!res.rows.length) {
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

      // -------------------- USERS STATS (MONARCH) ------------------------
      case "/users_stats": {
        if (!bypass) {
          await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
          return;
        }

        try {
          const totalRes = await pool.query(
            "SELECT COUNT(*)::int AS total FROM users"
          );
          const total = totalRes.rows[0]?.total ?? 0;

          const byRoleRes = await pool.query(`
            SELECT COALESCE(role, 'unknown') AS role,
                   COUNT(*)::int AS count
            FROM users
            GROUP BY COALESCE(role, 'unknown')
            ORDER BY role
          `);

          let out = "👥 Статистика пользователей СГ\n\n";
          out += `Всего пользователей: ${total}\n\n`;

          if (byRoleRes.rows.length) {
            out += "По ролям:\n";
            for (const r of byRoleRes.rows) out += `• ${r.role}: ${r.count}\n`;
          }

          await bot.sendMessage(chatId, out);
        } catch (e) {
          console.error("❌ Error in /users_stats:", e);
          await bot.sendMessage(chatId, "Не удалось получить статистику пользователей.");
        }
        return;
      }

      // --------------------------- DEMO TASK -----------------------------
      case "/demo_task": {
        const id = await createDemoTask(chatIdStr);
        await bot.sendMessage(chatId, `✅ Демо-задача создана!\nID: ${id}`);
        return;
      }

      // --------------------------- BTC TEST TASK -------------------------
      case "/btc_test_task": {
        try {
          const id = await createTestPriceMonitorTask(chatIdStr, access);
          await bot.sendMessage(chatId, `🆕 Тест price_monitor создан!\nID: ${id}`);
        } catch (e) {
          await bot.sendMessage(chatId, `⛔ ${e.message || "Запрещено"}`);
        }
        return;
      }

      // --------------------------- NEW TASK ------------------------------
      case "/newtask": {
        if (!rest) {
          await bot.sendMessage(chatId, "Использование: /newtask <описание>");
          return;
        }

        try {
          // title = rest, note = rest (минимально)
          const task = await createManualTask(chatIdStr, rest, rest, access);
          await bot.sendMessage(chatId, `🆕 Задача создана!\n#${task.id}`);
        } catch (e) {
          await bot.sendMessage(chatId, `⛔ ${e.message || "Запрещено"}`);
        }
        return;
      }

      // --------------------------- RUN TASK ------------------------------
      case "/run": {
        const id = Number((rest || "").trim());
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
        await runTaskWithAI(task, chatId, bot, access);
        return;
      }

      // --------------------------- TASKS LIST ----------------------------
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

      // ---------------------- STOP ALL TASKS -----------------------------
      case "/stop_all_tasks": {
        try {
          const res = await pool.query(`
            UPDATE tasks
            SET status = 'stopped'
            WHERE status = 'active';
          `);

          await bot.sendMessage(
            chatId,
            `⛔ Остановлены все активные задачи.\nИзменено записей: ${res.rowCount}.`
          );
        } catch (err) {
          console.error("❌ Error in /stop_all_tasks:", err);
          await bot.sendMessage(chatId, "⚠️ Ошибка при попытке остановить задачи.");
        }
        return;
      }

      // --------------------------- STOP TASK -----------------------------
      case "/stop_task": {
        const id = Number((rest || "").trim());
        if (!id) {
          await bot.sendMessage(chatId, "Использование: /stop_task <id>");
          return;
        }

        try {
          const res = await pool.query(
            `UPDATE tasks SET status = 'stopped' WHERE id = $1;`,
            [id]
          );

          if (res.rowCount === 0) {
            await bot.sendMessage(chatId, `⚠️ Задача с ID ${id} не найдена.`);
          } else {
            await bot.sendMessage(chatId, `⛔ Задача ${id} остановлена.`);
          }
        } catch (err) {
          console.error("❌ Error in /stop_task:", err);
          await bot.sendMessage(chatId, "⚠️ Ошибка при остановке задачи.");
        }
        return;
      }

      // --------------------------- START TASK ----------------------------
      case "/start_task": {
        const id = Number((rest || "").trim());
        if (!id) {
          await bot.sendMessage(chatId, "Использование: /start_task <id>");
          return;
        }

        try {
          const res = await pool.query(
            `UPDATE tasks SET status = 'active' WHERE id = $1;`,
            [id]
          );

          if (res.rowCount === 0) {
            await bot.sendMessage(chatId, `⚠️ Задача с ID ${id} не найдена.`);
          } else {
            await bot.sendMessage(chatId, `✅ Задача ${id} снова активна.`);
          }
        } catch (err) {
          console.error("❌ Error in /start_task:", err);
          await bot.sendMessage(chatId, "⚠️ Ошибка при запуске задачи.");
        }
        return;
      }

      // ------------------------ STOP TASKS BY TYPE -----------------------
      case "/stop_tasks_type": {
        const taskType = (rest || "").trim();
        if (!taskType) {
          await bot.sendMessage(
            chatId,
            "Использование: /stop_tasks_type <type>\nНапример: /stop_tasks_type price_monitor"
          );
          return;
        }

        try {
          const res = await pool.query(
            `UPDATE tasks SET status = 'stopped' WHERE type = $1 AND status = 'active';`,
            [taskType]
          );

          await bot.sendMessage(
            chatId,
            `⛔ Остановлены все активные задачи типа "${taskType}".\nИзменено записей: ${res.rowCount}.`
          );
        } catch (err) {
          console.error("❌ Error /stop_tasks_type:", err);
          await bot.sendMessage(chatId, "⚠️ Ошибка при остановке задач по типу.");
        }
        return;
      }

      // --------------------------- SOURCES -------------------------------
      case "/sources": {
        const sources = await getAllSourcesSafe();
        const out = formatSourcesList(sources);
        await bot.sendMessage(chatId, out, { parse_mode: "HTML" });
        return;
      }

      case "/sources_diag": {
        const summary = await runSourceDiagnosticsOnce({
          userRole,
          userPlan,
          bypassPermissions: bypass,
        });

        const textDiag =
          `🩺 Диагностика источников\n` +
          `Всего: ${summary.total}\n` +
          `OK: ${summary.okCount}\n` +
          `Ошибок: ${summary.failCount}`;

        await bot.sendMessage(chatId, textDiag);
        return;
      }

      case "/source": {
        const key = (rest || "").trim();
        if (!key) {
          await bot.sendMessage(chatId, "Использование: /source <key>");
          return;
        }

        const result = await fetchFromSourceKey(key, {
          userRole,
          userPlan,
          bypassPermissions: bypass,
        });

        if (!result.ok) {
          await bot.sendMessage(
            chatId,
            `❌ Ошибка при обращении к источнику <code>${key}</code>:\n<code>${
              result.error || "Unknown error"
            }</code>`,
            { parse_mode: "HTML" }
          );
          return;
        }

        await bot.sendMessage(chatId, JSON.stringify(result, null, 2).slice(0, 3500));
        return;
      }

      case "/diag_source": {
        const key = (rest || "").trim();
        if (!key) {
          await bot.sendMessage(
            chatId,
            "Использование: /diag_source <key>\nПример: /diag_source coingecko_simple_price",
            { parse_mode: "HTML" }
          );
          return;
        }

        try {
          const res = await diagnoseSource(key, {
            userRole,
            userPlan,
            bypassPermissions: bypass,
          });

          if (!res.ok) {
            await bot.sendMessage(
              chatId,
              [
                `Диагностика <code>${key}</code>: ❌`,
                res.error ? `Ошибка: <code>${res.error}</code>` : "Неизвестная ошибка",
              ].join("\n"),
              { parse_mode: "HTML" }
            );
            return;
          }

          await bot.sendMessage(
            chatId,
            [
              `Диагностика <code>${key}</code>: ✅ OK`,
              res.httpStatus ? `HTTP статус: <code>${res.httpStatus}</code>` : "HTTP статус: n/a",
              res.type ? `type: <code>${res.type}</code>` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            { parse_mode: "HTML" }
          );
        } catch (err) {
          console.error("❌ /diag_source error:", err);
          await bot.sendMessage(
            chatId,
            `Ошибка при диагностике: <code>${err.message || err}</code>`,
            { parse_mode: "HTML" }
          );
        }
        return;
      }

      // --------------------------- /price (CoinGecko) --------------------
      case "/price": {
        const coinId = (rest || "").trim().toLowerCase();
        if (!coinId) {
          await bot.sendMessage(chatId, "Использование: /price <coinId>\nПример: /price bitcoin");
          return;
        }

        const result = await getCoinGeckoSimplePriceById(coinId, "usd", {
          userRole,
          userPlan,
          bypassPermissions: bypass,
        });

        if (!result.ok) {
          const errText = String(result.error || "");
          if (result.httpStatus === 429 || errText.includes("429")) {
            await bot.sendMessage(chatId, "⚠️ CoinGecko вернул лимит (HTTP 429). Попробуй ещё раз через 1–2 минуты.");
          } else {
            await bot.sendMessage(chatId, `❌ Ошибка: ${result.error}`);
          }
          return;
        }

        await bot.sendMessage(chatId, `💰 ${result.id.toUpperCase()}: $${result.price}`);
        return;
      }

      // --------------------------- /prices (multi) -----------------------
      case "/prices": {
        const idsArg = (rest || "").trim().toLowerCase();
        const ids = idsArg
          ? idsArg
              .split(/[,\s]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : ["bitcoin", "ethereum", "solana"];

        const result = await getCoinGeckoSimplePriceMulti(ids, "usd", {
          userRole,
          userPlan,
          bypassPermissions: bypass,
        });

        if (!result.ok) {
          const errText = String(result.error || "");
          if (result.httpStatus === 429 || errText.includes("429")) {
            await bot.sendMessage(chatId, "⚠️ CoinGecko вернул лимит (HTTP 429). Попробуй ещё раз через 1–2 минуты.");
          } else {
            await bot.sendMessage(chatId, `❌ Ошибка: ${result.error}`);
          }
          return;
        }

        let out = "💰 Цены (CoinGecko, USD):\n\n(лимит вывода)\n";
        for (const id of ids) {
          const item = result.items?.[id];
          out += item ? `• ${item.id.toUpperCase()}: $${item.price}\n` : `• ${id.toUpperCase()}: нет данных\n`;
        }

        await bot.sendMessage(chatId, out);
        return;
      }

      // --------------------------- PROJECT MEMORY ------------------------
      case "/pm_show": {
        const section = (rest || "").trim();
        if (!section) {
          await bot.sendMessage(chatId, "Использование: /pm_show <section>");
          return;
        }

        try {
          const rec = await getProjectSection(undefined, section);
          if (!rec) {
            await bot.sendMessage(chatId, `Секция "${section}" отсутствует.`);
            return;
          }
          await bot.sendMessage(
            chatId,
            `🧠 Project Memory: ${rec.section}\n\n${String(rec.content || "").slice(0, 3500)}`
          );
        } catch (e) {
          console.error("❌ /pm_show error:", e);
          await bot.sendMessage(chatId, "⚠️ Ошибка чтения Project Memory.");
        }
        return;
      }

      case "/pm_set": {
        if (!bypass) {
          await bot.sendMessage(chatId, "Только монарх может менять Project Memory.");
          return;
        }

        const { first: section, tail: content } = firstWordAndRest(rest);

        if (!section || !content) {
          await bot.sendMessage(
            chatId,
            "Использование: /pm_set <section> <text>\n(Можно с переносами строк)"
          );
          return;
        }

        try {
          await upsertProjectSection({
            section,
            title: null,
            content,
            tags: [],
            meta: { setBy: chatIdStr },
            schemaVersion: 1,
          });

          await bot.sendMessage(chatId, `✅ Обновлено: ${section}`);
        } catch (e) {
          console.error("❌ /pm_set error:", e);
          await bot.sendMessage(chatId, "⚠️ Ошибка записи Project Memory.");
        }
        return;
      }

      // --------------------------- ANSWER MODE ---------------------------
      case "/mode": {
        const mode = (rest || "").trim().toLowerCase();
        const valid = ["short", "normal", "long"];

        if (!valid.includes(mode)) {
          await bot.sendMessage(chatId, "Режимы: short / normal / long");
          return;
        }

        setAnswerMode(chatIdStr, mode);
        await bot.sendMessage(chatId, `Режим ответа: ${mode}`);
        return;
      }

      default:
        return;
    }
  }

  // ========================================================================
  // === NOT COMMANDS: FILE-INTAKE + MEMORY + CONTEXT + AI ===
  // ========================================================================

  // Если есть вложение — скачиваем и подтверждаем (коротко)
  let intake = null;
  if (mediaSummary) {
    try {
      intake = await intakeAndDownloadIfNeeded(msg, token);
      const fileName = intake?.downloaded?.fileName || "file";
      await bot.sendMessage(chatId, `✅ Файл принят: ${intake.kind} (${fileName})`);
    } catch (e) {
      console.error("❌ File-Intake download error:", e);
      await bot.sendMessage(chatId, "⚠️ Не удалось скачать файл (File-Intake).");
    }
  }

  // Формируем текст для памяти/ИИ
  const mediaText = intake
    ? `Attachment: kind=${intake.kind}; fileName=${intake.downloaded?.fileName || ""}; localPath=${intake.downloaded?.localPath || ""}`
    : (mediaSummary ? `Attachment: kind=${mediaSummary.kind}` : "");

  let effective = trimmed || mediaText;
  if (trimmed && mediaText) effective = `${trimmed}\n\n(${mediaText})`;

  // 1) save user message
  await saveMessageToMemory(chatIdStr, "user", effective);

  // 2) history
  const history = await getChatHistory(chatIdStr, MAX_HISTORY_MESSAGES);

  // 3) classification (пока V0)
  const classification = { taskType: "chat", aiCostLevel: "low" };
  await logInteraction(chatIdStr, classification);

  // 4) project context
  const projectCtx = await loadProjectContext();

  // 5) system prompt
  const answerMode = getAnswerMode(chatIdStr);

  let modeInstruction = "";
  if (answerMode === "short") {
    modeInstruction = "Режим short: отвечай очень кратко (1–2 предложения), только по существу, без лишних деталей.";
  } else if (answerMode === "normal") {
    modeInstruction = "Режим normal: давай развёрнутый, но компактный ответ (3–7 предложений), с ключевыми деталями.";
  } else if (answerMode === "long") {
    modeInstruction = "Режим long: можно отвечать подробно, структурированно, с примерами и пояснениями.";
  }

  const systemPrompt = buildSystemPrompt(answerMode, modeInstruction, projectCtx || "");

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: effective },
  ];

  // 6) output params
  let maxTokens = 350;
  let temperature = 0.6;
  if (answerMode === "short") {
    maxTokens = 150;
    temperature = 0.3;
  } else if (answerMode === "long") {
    maxTokens = 900;
    temperature = 0.8;
  }

  // 7) AI call
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

  // 8) save pair
  await saveChatPair(chatIdStr, effective, aiReply);

  // 9) send
  try {
    await bot.sendMessage(chatId, aiReply);
  } catch (e) {
    console.error("❌ Telegram send error:", e);
  }
});

console.log("🤖 SG (GARYA AI Bot) работает…");
