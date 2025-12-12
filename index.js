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
import * as FileIntake from "./src/media/fileIntake.js";

// === LOGGING (interaction_logs) ===
import { logInteraction } from "./src/logging/interactionLogs.js";

// === ROBOT MOCK-LAYER ===
import { startRobotLoop } from "./src/robot/robotMock.js";

// === AI ===
import { callAI } from "./ai.js";

// === PROJECT MEMORY ===
import { getProjectSection, upsertProjectSection } from "./projectMemory.js";

// === DB ===
import pool from "./db.js";

// ============================================================================
// === CONSTANTS / CONFIG ===
// ============================================================================
const MAX_HISTORY_MESSAGES = 20;

// MONARCH by chat_id (Telegram user id)
const MONARCH_CHAT_ID = (process.env.MONARCH_CHAT_ID || "677128443").toString();

// Plans placeholder
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

/**
 * 7F.10 — FILE-INTAKE LOGS (самодостаточно в index.js)
 * Таблица:
 * - фиксируем решения: hasText / shouldCallAI / direct / aiCalled / aiError
 * - мета: jsonb (не ломает скелет, можно расширять без миграций)
 */
async function ensureFileIntakeLogsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS file_intake_logs (
      id BIGSERIAL PRIMARY KEY,
      chat_id TEXT NOT NULL,
      message_id BIGINT,
      kind TEXT,
      file_id TEXT,
      file_unique_id TEXT,
      file_name TEXT,
      mime_type TEXT,
      file_size BIGINT,

      has_text BOOLEAN NOT NULL DEFAULT FALSE,
      should_call_ai BOOLEAN NOT NULL DEFAULT FALSE,
      direct_reply BOOLEAN NOT NULL DEFAULT FALSE,

      processed_text_chars INT NOT NULL DEFAULT 0,

      ai_called BOOLEAN NOT NULL DEFAULT FALSE,
      ai_error BOOLEAN NOT NULL DEFAULT FALSE,

      meta JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_file_intake_logs_chat_created
    ON file_intake_logs (chat_id, created_at DESC);
  `);
}

async function logFileIntakeEvent(chatIdStr, payload) {
  try {
    const {
      messageId = null,
      kind = null,
      fileId = null,
      fileUniqueId = null,
      fileName = null,
      mimeType = null,
      fileSize = null,

      hasText = false,
      shouldCallAI = false,
      directReply = false,

      processedTextChars = 0,

      aiCalled = false,
      aiError = false,

      meta = {},
    } = payload || {};

    await pool.query(
      `
      INSERT INTO file_intake_logs (
        chat_id, message_id, kind, file_id, file_unique_id, file_name, mime_type, file_size,
        has_text, should_call_ai, direct_reply, processed_text_chars,
        ai_called, ai_error, meta
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15
      )
      `,
      [
        chatIdStr,
        messageId,
        kind,
        fileId,
        fileUniqueId,
        fileName,
        mimeType,
        fileSize,

        Boolean(hasText),
        Boolean(shouldCallAI),
        Boolean(directReply),
        Number(processedTextChars) || 0,

        Boolean(aiCalled),
        Boolean(aiError),
        meta || {},
      ]
    );
  } catch (err) {
    console.error("❌ Error in logFileIntakeEvent:", err);
  }
}

async function getRecentFileIntakeLogs(chatIdStr, limit = 10) {
  const n = Math.max(1, Math.min(Number(limit) || 10, 30));
  const res = await pool.query(
    `
    SELECT *
    FROM file_intake_logs
    WHERE chat_id = $1
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [chatIdStr, n]
  );
  return res.rows || [];
}

async function callWithFallback(fn, variants) {
  let lastErr = null;
  for (const args of variants) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn(...args);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("callWithFallback failed");
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
    await ensureProjectMemoryTable();
    console.log("🧠 Project Memory table OK.");

    // 7F.10 logs
    await ensureFileIntakeLogsTable();
    console.log("🧾 File-Intake logs table OK.");

    await ensureDefaultSources();
    console.log("📡 Sources registry готов.");

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

  const access = {
    userRole,
    userPlan,
    bypassPermissions: bypass,
  };

  // ========================================================================
  // === COMMANDS ===
  // ========================================================================
  if (trimmed.startsWith("/")) {
    const parsed = parseCommand(trimmed);
    const cmd = parsed?.cmd || trimmed.split(" ")[0];
    const rest = parsed?.rest || "";

    switch (cmd) {
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

      // ===== 7F.10 — VIEW FILE INTAKE LOGS (MONARCH) =====
      case "/file_logs": {
        if (!bypass) {
          await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
          return;
        }

        const n = Number((rest || "").trim()) || 10;
        const rows = await getRecentFileIntakeLogs(chatIdStr, n);

        if (!rows.length) {
          await bot.sendMessage(chatId, "file_intake_logs пусто (пока нет записей).");
          return;
        }

        let out = `🧾 File-Intake logs (last ${Math.min(Number(n) || 10, 30)})\n\n`;
        for (const r of rows) {
          out += `#${r.id} | ${new Date(r.created_at).toISOString()}\n`;
          out += `kind=${r.kind || "?"} hasText=${r.has_text} shouldAI=${r.should_call_ai} direct=${r.direct_reply}\n`;
          out += `aiCalled=${r.ai_called} aiError=${r.ai_error} textChars=${r.processed_text_chars}\n`;
          if (r.file_name || r.mime_type || r.file_size) {
            out += `file=${r.file_name || "-"} mime=${r.mime_type || "-"} size=${r.file_size || "-"}\n`;
          }
          out += `\n`;
        }

        await bot.sendMessage(chatId, out.slice(0, 3800));
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
          const id = await callWithFallback(createTestPriceMonitorTask, [
            [chatIdStr, access],
            [chatIdStr],
          ]);
          await bot.sendMessage(chatId, `🆕 Тест price_monitor создан!\nID: ${id?.id || id}`);
        } catch (e) {
          await bot.sendMessage(chatId, `⛔ ${e?.message || "Запрещено"}`);
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
          const task = await callWithFallback(createManualTask, [
            [chatIdStr, rest, rest, access],
            [chatIdStr, rest, access],
            [chatIdStr, rest, rest],
            [chatIdStr, rest],
          ]);
          await bot.sendMessage(chatId, `🆕 Задача создана!\n#${task?.id || task}`);
        } catch (e) {
          await bot.sendMessage(chatId, `⛔ ${e?.message || "Запрещено"}`);
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
        try {
          await callWithFallback(runTaskWithAI, [
            [task, chatId, bot, access],
            [task, chatId, bot],
            [task, chatId],
          ]);
        } catch (e) {
          console.error("❌ runTaskWithAI error:", e);
          await bot.sendMessage(chatId, "⚠️ Ошибка при запуске задачи.");
        }
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

        let out = "💰 Цены (CoinGecko, USD):\n\n";
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
        const modeRaw = (rest || "").trim();
        if (!modeRaw) {
          await bot.sendMessage(chatId, "Использование: /mode short | normal | long");
          return;
        }

        const mode = modeRaw.toLowerCase();
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

  const messageId = msg.message_id ?? null;

  // summary
  const summarizeMediaAttachment =
    typeof FileIntake.summarizeMediaAttachment === "function"
      ? FileIntake.summarizeMediaAttachment
      : () => null;

  const mediaSummary = summarizeMediaAttachment(msg);

  // decision
  const decisionFn =
    typeof FileIntake.buildEffectiveUserTextAndDecision === "function"
      ? FileIntake.buildEffectiveUserTextAndDecision
      : null;

  const decision = decisionFn
    ? decisionFn(trimmed, mediaSummary)
    : {
        effectiveUserText: trimmed,
        shouldCallAI: Boolean(trimmed),
        directReplyText: Boolean(trimmed) ? null : "Напиши текстом, что нужно сделать.",
      };

  const effective = (decision?.effectiveUserText || "").trim();
  const shouldCallAI = Boolean(decision?.shouldCallAI);
  const directReplyText = decision?.directReplyText || null;

  // log intake (before any reply/ai)
  if (mediaSummary) {
    await logFileIntakeEvent(chatIdStr, {
      messageId,
      kind: mediaSummary.kind,
      fileId: mediaSummary.fileId,
      fileUniqueId: mediaSummary.fileUniqueId,
      fileName: mediaSummary.fileName || null,
      mimeType: mediaSummary.mimeType || null,
      fileSize: mediaSummary.fileSize || null,
      hasText: Boolean(trimmed),
      shouldCallAI,
      directReply: Boolean(directReplyText),
      processedTextChars: effective ? effective.length : 0,
      aiCalled: false,
      aiError: false,
      meta: { caption: mediaSummary.caption || null, phase: "before_reply_or_ai" },
    });
  }

  // direct reply (stub) -> exit
  if (directReplyText) {
    await bot.sendMessage(chatId, directReplyText);
    return;
  }

  if (!shouldCallAI) {
    await bot.sendMessage(chatId, "Напиши текстом, что нужно сделать.");
    return;
  }

  // memory
  await saveMessageToMemory(chatIdStr, "user", effective);
  const history = await getChatHistory(chatIdStr, MAX_HISTORY_MESSAGES);

  // classification V0
  const classification = { taskType: "chat", aiCostLevel: "low" };
  await logInteraction(chatIdStr, classification);

  // context + prompt
  const projectCtx = await loadProjectContext();
  const answerMode = getAnswerMode(chatIdStr);

  let modeInstruction = "";
  if (answerMode === "short") {
    modeInstruction =
      "Режим short: отвечай очень кратко (1–2 предложения), только по существу, без лишних деталей.";
  } else if (answerMode === "normal") {
    modeInstruction =
      "Режим normal: давай развёрнутый, но компактный ответ (3–7 предложений), с ключевыми деталями.";
  } else if (answerMode === "long") {
    modeInstruction =
      "Режим long: можно отвечать подробно, структурированно, с примерами и пояснениями.";
  }

  const systemPrompt = buildSystemPrompt(answerMode, modeInstruction, projectCtx || "");
  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: effective },
  ];

  let maxTokens = 350;
  let temperature = 0.6;
  if (answerMode === "short") {
    maxTokens = 150;
    temperature = 0.3;
  } else if (answerMode === "long") {
    maxTokens = 900;
    temperature = 0.8;
  }

  // AI call
  let aiReply = "";
  let aiError = false;
  try {
    aiReply = await callAI(messages, classification.aiCostLevel, {
      max_output_tokens: maxTokens,
      temperature,
    });
  } catch (e) {
    console.error("❌ AI error:", e);
    aiReply = "⚠️ Ошибка вызова ИИ.";
    aiError = true;
  }

  // log intake after AI
  if (mediaSummary) {
    await logFileIntakeEvent(chatIdStr, {
      messageId,
      kind: mediaSummary.kind,
      fileId: mediaSummary.fileId,
      fileUniqueId: mediaSummary.fileUniqueId,
      fileName: mediaSummary.fileName || null,
      mimeType: mediaSummary.mimeType || null,
      fileSize: mediaSummary.fileSize || null,
      hasText: Boolean(trimmed),
      shouldCallAI,
      directReply: false,
      processedTextChars: effective ? effective.length : 0,
      aiCalled: true,
      aiError,
      meta: { phase: "after_ai" },
    });
  }

  await saveChatPair(chatIdStr, effective, aiReply);

  try {
    await bot.sendMessage(chatId, aiReply);
  } catch (e) {
    console.error("❌ Telegram send error:", e);
  }
});

console.log("🤖 SG (GARYA AI Bot) работает…");
