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
import { can } from "./src/users/permissions.js"; // ✅ 7.8 Permissions-layer

// ✅ 7.11.x — access_requests (auto-create + create request)
import * as AccessRequests from "./src/users/accessRequests.js";

// === TASK ENGINE ===
import {
  createDemoTask,
  createManualTask,
  createTestPriceMonitorTask,
  getUserTasks,
  getTaskById,
  runTaskWithAI,
  updateTaskStatus, // ✅ used for stop/start via taskEngine
} from "./src/tasks/taskEngine.js";

// === SOURCES LAYER ===
import {
  ensureDefaultSources,
  runSourceDiagnosticsOnce,
  getAllSourcesSafe,
  fetchFromSourceKey,
  formatSourcesList,
  diagnoseSource,
  testSource,
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

import { runDiagnostics } from "./diagnostics/diagnostics.js";

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

// === 7.10 helpers: task ownership + stop permissions (V1) ===
function isOwnerTaskRow(taskRow, chatIdStr) {
  const owner = (taskRow?.user_chat_id ?? "").toString();
  return owner === chatIdStr.toString();
}

function canStopTaskV1({ userRole, bypass, taskType, isOwner }) {
  if (bypass) return true;
  if (!isOwner) return false;

  if ((userRole || "guest").toLowerCase() === "guest") {
    // V1 правило: гость не может останавливать price_monitor
    if (taskType === "price_monitor") return false;
    return true;
  }

  return true;
}

async function getTaskRowById(taskId) {
  const res = await pool.query(
    `
    SELECT id, user_chat_id, title, type, status, payload, schedule, last_run, created_at
    FROM tasks
    WHERE id = $1
    LIMIT 1
    `,
    [taskId]
  );
  return res.rows[0] || null;
}

// ============================================================================
// === EXPRESS SERVER ===
// ============================================================================
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json(getSystemHealth());
});

// ============================================================================
// === TELEGRAM BOT + WEBHOOK ===
// ============================================================================
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN отсутствует!");
  process.exit(1);
}

const bot = new TelegramBot(token);

const MONARCH_ID = 677128443;

bot.onText(/\/health/, (msg) => {
  if (msg.from?.id !== MONARCH_ID) return;
  bot.sendMessage(msg.chat.id, "OK: telegram health");
});

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

  runDiagnostics({
  rootDir: process.cwd(),
  pool,
  monarchChatId: MONARCH_CHAT_ID,
});

  console.log("🌐 HTTP-сервер запущен на порту:", PORT);

  try {
    await ensureProjectMemoryTable();
    console.log("🧠 Project Memory table OK.");

    // 7F.10 logs
    await ensureFileIntakeLogsTable();
    console.log("🧾 File-Intake logs table OK.");

    // ✅ 7.11.5 — access_requests (auto-create)
    if (typeof AccessRequests.ensureAccessRequestsTable === "function") {
      await AccessRequests.ensureAccessRequestsTable();
      console.log("🛡️ Access Requests table OK.");
    } else {
      console.log("⚠️ AccessRequests.ensureAccessRequestsTable() not found (skip).");
    }

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

  const senderId = msg.from?.id;
  const senderIdStr = senderId?.toString() || "";

  const text = msg.text || "";
  const trimmed = text.trim();

  // 0) User profile
  await ensureUserProfile(msg);

  // 1) role + plan
  let userRole = "guest";
  let userPlan = DEFAULT_PLAN;

  try {
    const uRes = await pool.query("SELECT role FROM users WHERE chat_id = $1", [
      senderIdStr,
    ]);
    if (uRes.rows.length) userRole = uRes.rows[0].role || "guest";
  } catch (e) {
  console.error("❌ Error fetching user role:", e);
}

// ✅ SAFETY: только реальный MONARCH_CHAT_ID может иметь роль monarch
if ((userRole || "").toLowerCase() === "monarch" && !isMonarch(senderIdStr)) {
  console.warn("⚠️ ROLE GUARD: non-monarch had role=monarch in DB:", senderIdStr);
  userRole = "guest";
}

const bypass = isMonarch(senderIdStr);

  const access = {
    userRole,
    userPlan,
    bypassPermissions: bypass,
  };

  // ✅ единый user-объект для permissions-layer
  const user = { role: userRole, plan: userPlan, bypassPermissions: bypass };

  // ✅ mapping команд → action keys (единый контроль)
  const CMD_ACTION = {
    "/profile": "cmd.profile",
    "/me": "cmd.profile",
    "/whoami": "cmd.profile",

    "/mode": "cmd.mode",

    "/tasks": "cmd.tasks.list",
    "/run": "cmd.task.run",
    "/newtask": "cmd.task.create",

    "/price": "cmd.price",
    "/prices": "cmd.prices",

    "/sources": "cmd.sources.list",
    "/source": "cmd.source.fetch",
    "/diag_source": "cmd.source.diagnose",

    // ✅ 5.7.3
    "/test_source": "cmd.source.test",

    // ✅ admin / critical — чтобы у гостя срабатывал Access Request (7.11)
    "/stop_all_tasks": "cmd.admin.stop_all_tasks",
    "/start_task": "cmd.admin.start_task",
    "/stop_tasks_type": "cmd.admin.stop_tasks_type",
    "/users_stats": "cmd.admin.users_stats",
    "/file_logs": "cmd.admin.file_logs",
    "/pm_set": "cmd.admin.pm_set",

    // ✅ 7.11 V1 helpers (monarch self-test)
    "/ar_create_test": "cmd.admin.ar_create_test",
    "/ar_list": "cmd.admin.ar_list",
  };

  // ✅ V1 guard: если команда есть в карте — проверяем can()
  // ✅ 7.11 — если нельзя: создаём заявку монарху + уведомление
  async function requirePermOrReply(cmd, context = {}) {
    const action = CMD_ACTION[cmd];
    if (!action) return true; // команды вне карты (в т.ч. монаршие) — старые проверки остаются
    if (can(user, action)) return true;

    // requester name (best effort)
    const requesterName =
      msg?.from?.username
        ? `@${msg.from.username}`
        : [msg?.from?.first_name, msg?.from?.last_name].filter(Boolean).join(" ").trim() ||
          null;

    // ✅ Correct integration with AccessRequests schema + helper
    try {
      if (typeof AccessRequests.createAccessRequestAndNotify === "function") {
        const pack = await AccessRequests.createAccessRequestAndNotify({
          bot,
          monarchChatId: MONARCH_CHAT_ID,
          requesterChatId: senderIdStr,
          requesterName,
          requesterRole: userRole,
          requestedAction: action,
          requestedCmd: cmd,
          meta: {
            cmd,
            action,
            role: userRole,
            plan: userPlan,
            text: trimmed?.slice(0, 800) || "",
            rest: (context?.rest || "").slice(0, 1200),
            at: new Date().toISOString(),
          },
        });

        await bot.sendMessage(chatId, pack?.guestText || "⛔ Недостаточно прав.");
      } else if (typeof AccessRequests.createAccessRequest === "function") {
        // fallback: create only (no notify helper)
        const reqRow = await AccessRequests.createAccessRequest({
          requesterChatId: senderIdStr,
          requesterName,
          requesterRole: userRole,
          requestedAction: action,
          requestedCmd: cmd,
          meta: {
            cmd,
            action,
            role: userRole,
            plan: userPlan,
            text: trimmed?.slice(0, 800) || "",
            rest: (context?.rest || "").slice(0, 1200),
            at: new Date().toISOString(),
          },
        });

        const reqId = reqRow?.id;
        await bot.sendMessage(
          chatId,
          reqId
            ? `⛔ Недостаточно прав.\n✅ Заявка #${reqId} отправлена монарху.`
            : "⛔ Недостаточно прав."
        );

        // notify monarch (best-effort)
        if (reqId) {
          try {
            await bot.sendMessage(
              Number(MONARCH_CHAT_ID),
              [
                `🛡️ ACCESS REQUEST #${reqId}`,
                `requester_chat_id: ${senderIdStr}`,
                requesterName ? `name: ${requesterName}` : "",
                `role: ${userRole}`,
                `plan: ${userPlan}`,
                `requested_action: ${action}`,
                `requested_cmd: ${cmd}`,
                trimmed ? `text: ${trimmed.slice(0, 500)}` : "",
                ``,
                `Команды: /approve ${reqId}  |  /deny ${reqId}`,
              ]
                .filter(Boolean)
                .join("\n")
            );
          } catch (e) {
            // ignore
          }
        }
      } else {
        await bot.sendMessage(chatId, "⛔ Недостаточно прав.");
      }
    } catch (e) {
      await bot.sendMessage(chatId, "⛔ Недостаточно прав.");
    }

    return false;
  }

// ========================================================================
  // === COMMANDS ===
  // ========================================================================
  if (trimmed.startsWith("/")) {
    // ⚠️ /health handled by bot.onText(/\/health/, ...) выше.
    // Этот дубль был опасен (message is not defined) и мог ломать обработку команд.
    // Оставляем заглушку, чтобы случайно не вернуть баг.
    /*
    if (text && text.startsWith("/health")) {
      if (message.from.id !== 677128443) {
        return;
      }
      const h = getSystemHealth();
      await bot.sendMessage(
        chatId,
        `Status: ${h.status}\nUptime: ${h.uptime}\nMemory: ${h.memory.heapUsed}/${h.memory.heapTotal}`
      );
      return;
    }
    */

    const parsed = parseCommand(trimmed);
    const cmd = parsed?.cmd || trimmed.split(" ")[0];
    const rest = parsed?.rest || "";

    // ✅ Permissions-layer check (only if mapped)
    if (!(await requirePermOrReply(cmd, { rest }))) return;

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

      // ====================================================================
      // ✅ 7.11.3 /approve + ✅ 7.11.4 /deny (MONARCH ONLY)
      // ====================================================================
      case "/approve": {
        if (!bypass) {
          await bot.sendMessage(
            chatId,
            "Эта команда доступна только монарху GARYA."
          );
          return;
        }

        const id = Number((rest || "").trim());
        if (!id) {
          await bot.sendMessage(chatId, "Использование: /approve <request_id>");
          return;
        }

        try {
          if (typeof AccessRequests.approveAccessRequest !== "function") {
            await bot.sendMessage(
              chatId,
              "approveAccessRequest() не найден в src/users/accessRequests.js"
            );
            return;
          }

          const result = await AccessRequests.approveAccessRequest({
            requestId: id,
            resolvedBy: chatIdStr,
          });

          if (!result?.ok) {
            await bot.sendMessage(
              chatId,
              `⚠️ Не удалось approve: ${result?.error || "unknown"}`
            );
            return;
          }

          const req =
            result.request ||
            result.row ||
            result.data ||
            result.accessRequest ||
            null;

          // ✅ correct field for requester
          const requesterChatId =
            req?.requester_chat_id ||
            req?.requesterChatId ||
            req?.chat_id ||
            req?.chatId ||
            req?.user_chat_id ||
            null;

          if (requesterChatId) {
            try {
              await bot.sendMessage(
                Number(requesterChatId),
                `✅ Монарх одобрил вашу заявку #${id}.`
              );
            } catch (e) {
              // ignore notify error
            }
          }

          await bot.sendMessage(chatId, `✅ Заявка #${id} одобрена.`);
        } catch (e) {
          console.error("❌ /approve error:", e);
          await bot.sendMessage(chatId, "⚠️ Ошибка при approve.");
        }

        return;
      }

      case "/deny": {
        if (!bypass) {
          await bot.sendMessage(
            chatId,
            "Эта команда доступна только монарху GARYA."
          );
          return;
        }

        const id = Number((rest || "").trim());
        if (!id) {
          await bot.sendMessage(chatId, "Использование: /deny <request_id>");
          return;
        }

        try {
          if (typeof AccessRequests.denyAccessRequest !== "function") {
            await bot.sendMessage(
              chatId,
              "denyAccessRequest() не найден в src/users/accessRequests.js"
            );
            return;
          }

          const result = await AccessRequests.denyAccessRequest({
            requestId: id,
            resolvedBy: chatIdStr,
          });

          if (!result?.ok) {
            await bot.sendMessage(
              chatId,
              `⚠️ Не удалось deny: ${result?.error || "unknown"}`
            );
            return;
          }

          const req =
            result.request ||
            result.row ||
            result.data ||
            result.accessRequest ||
            null;

          // ✅ correct field for requester
          const requesterChatId =
            req?.requester_chat_id ||
            req?.requesterChatId ||
            req?.chat_id ||
            req?.chatId ||
            req?.user_chat_id ||
            null;

          if (requesterChatId) {
            try {
              await bot.sendMessage(
                Number(requesterChatId),
                `⛔ Монарх отклонил вашу заявку #${id}.`
              );
            } catch (e) {
              // ignore notify error
            }
          }

          await bot.sendMessage(chatId, `⛔ Заявка #${id} отклонена.`);
        } catch (e) {
          console.error("❌ /deny error:", e);
          await bot.sendMessage(chatId, "⚠️ Ошибка при deny.");
        }

        return;
      }

      // ====================================================================
      // ✅ 7.11 V1 — Self-test (MONARCH ONLY): create test access_request
      // ====================================================================
      case "/ar_create_test": {
        if (!bypass) {
          await bot.sendMessage(
            chatId,
            "Эта команда доступна только монарху GARYA."
          );
          return;
        }

        try {
          if (typeof AccessRequests.createAccessRequest !== "function") {
            await bot.sendMessage(
              chatId,
              "createAccessRequest() не найден в src/users/accessRequests.js"
            );
            return;
          }

          const nowIso = new Date().toISOString();

          const reqRow = await AccessRequests.createAccessRequest({
            requesterChatId: chatIdStr, // self-test: requester = monarch
            requesterName: "MONARCH_SELF_TEST",
            requesterRole: userRole,
            requestedAction: "cmd.admin.stop_all_tasks",
            requestedCmd: "/stop_all_tasks",
            meta: {
              test: true,
              createdBy: chatIdStr,
              at: nowIso,
              note: "Self-test request (7.11 V1).",
            },
          });

          const reqId = reqRow?.id;

          await bot.sendMessage(
            chatId,
            reqId
              ? `🧪 Создана тестовая заявка #${reqId}\nКоманды: /approve ${reqId} | /deny ${reqId}`
              : "⚠️ Не удалось создать тестовую заявку (id отсутствует)."
          );
        } catch (e) {
          console.error("❌ /ar_create_test error:", e);
          await bot.sendMessage(chatId, "⚠️ Ошибка при создании тестовой заявки.");
        }

        return;
      }

      // ====================================================================
      // ✅ 7.11 V1 — List access_requests (MONARCH ONLY)
      // ====================================================================
      case "/ar_list": {
        if (!bypass) {
          await bot.sendMessage(
            chatId,
            "Эта команда доступна только монарху GARYA."
          );
          return;
        }

        const n = Math.max(1, Math.min(Number((rest || "").trim()) || 10, 30));

        try {
          const res = await pool.query(
            `
            SELECT
              id,
              COALESCE(status, 'pending') AS status,
              COALESCE(requester_chat_id, chat_id, user_chat_id) AS requester_chat_id,
              COALESCE(requester_name, '') AS requester_name,
              COALESCE(requester_role, '') AS requester_role,
              COALESCE(requested_action, requestedAction, '') AS requested_action,
              COALESCE(requested_cmd, requestedCmd, '') AS requested_cmd,
              created_at
            FROM access_requests
            ORDER BY created_at DESC
            LIMIT $1
            `,
            [n]
          );

          if (!res.rows?.length) {
            await bot.sendMessage(chatId, "🛡️ access_requests пусто.");
            return;
          }

          let out = `🛡️ Access Requests (last ${res.rows.length})\n\n`;
          for (const r of res.rows) {
            out += `#${r.id} | ${r.status} | ${new Date(r.created_at).toISOString()}\n`;
            out += `who=${r.requester_chat_id}${r.requester_name ? ` (${r.requester_name})` : ""}\n`;
            if (r.requester_role) out += `role=${r.requester_role}\n`;
            if (r.requested_action) out += `action=${r.requested_action}\n`;
            if (r.requested_cmd) out += `cmd=${r.requested_cmd}\n`;
            out += `\n`;
          }

          await bot.sendMessage(chatId, out.slice(0, 3800));
        } catch (e) {
          console.error("❌ /ar_list error:", e);
          await bot.sendMessage(
            chatId,
            "⚠️ Не удалось прочитать access_requests (проверь таблицу/колонки)."
          );
        }

        return;
      }

      // ===== 7F.10 — VIEW FILE INTAKE LOGS (MONARCH) =====
      case "/file_logs": {
        if (!bypass) {
          await bot.sendMessage(
            chatId,
            "Эта команда доступна только монарху GARYA."
          );
          return;
        }

        const n = Number((rest || "").trim()) || 10;
        const rows = await getRecentFileIntakeLogs(chatIdStr, n);

        if (!rows.length) {
          await bot.sendMessage(
            chatId,
            "file_intake_logs пусто (пока нет записей)."
          );
          return;
        }

        let out = `🧾 File-Intake logs (last ${Math.min(
          Number(n) || 10,
          30
        )})\n\n`;
        for (const r of rows) {
          out += `#${r.id} | ${new Date(r.created_at).toISOString()}\n`;
          out += `kind=${r.kind || "?"} hasText=${r.has_text} shouldAI=${
            r.should_call_ai
          } direct=${r.direct_reply}\n`;
          out += `aiCalled=${r.ai_called} aiError=${r.ai_error} textChars=${
            r.processed_text_chars
          }\n`;
          if (r.file_name || r.mime_type || r.file_size) {
            out += `file=${r.file_name || "-"} mime=${r.mime_type || "-"} size=${
              r.file_size || "-"
            }\n`;
          }
          out += `\n`;
        }

        await bot.sendMessage(chatId, out.slice(0, 3800));
        return;
      }

      // -------------------- USERS STATS (MONARCH) ------------------------
      case "/users_stats": {
        if (!bypass) {
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
          await bot.sendMessage(
            chatId,
            "Не удалось получить статистику пользователей."
          );
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
          await bot.sendMessage(
            chatId,
            `🆕 Тест price_monitor создан!\nID: ${id?.id || id}`
          );
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
          await bot.sendMessage(
            chatId,
            `🆕 Задача создана!\n#${task?.id || task}`
          );
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
        // ✅ 7.10: access-aware list
        const tasks = await getUserTasks(chatIdStr, 30, access);

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
        // ✅ критическая команда — только монарх
        if (!bypass) {
          await bot.sendMessage(
            chatId,
            "Эта команда доступна только монарху GARYA."
          );
          return;
        }

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
          await bot.sendMessage(
            chatId,
            "⚠️ Ошибка при попытке остановить задачи."
          );
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
          const taskRow = await getTaskRowById(id);
          if (!taskRow) {
            await bot.sendMessage(chatId, `⚠️ Задача с ID ${id} не найдена.`);
            return;
          }

          const owner = isOwnerTaskRow(taskRow, chatIdStr);

          // ✅ 7.10 task:stop
          const allowed = canStopTaskV1({
            userRole,
            bypass,
            taskType: taskRow.type,
            isOwner: owner,
          });

          if (!allowed) {
            await bot.sendMessage(
              chatId,
              "⛔ Недостаточно прав для остановки задачи."
            );
            return;
          }

          await updateTaskStatus(id, "stopped");
          await bot.sendMessage(chatId, `⛔ Задача ${id} остановлена.`);
        } catch (err) {
          console.error("❌ Error in /stop_task:", err);
          await bot.sendMessage(chatId, "⚠️ Ошибка при остановке задачи.");
        }
        return;
      }

      // --------------------------- START TASK ----------------------------
      case "/start_task": {
        // ✅ критическая команда — только монарх (иначе можно активировать чужие)
        if (!bypass) {
          await bot.sendMessage(
            chatId,
            "Эта команда доступна только монарху GARYA."
          );
          return;
        }

        const id = Number((rest || "").trim());
        if (!id) {
          await bot.sendMessage(chatId, "Использование: /start_task <id>");
          return;
        }

        try {
          await updateTaskStatus(id, "active");
          await bot.sendMessage(chatId, `✅ Задача ${id} снова активна.`);
        } catch (err) {
          console.error("❌ Error in /start_task:", err);
          await bot.sendMessage(chatId, "⚠️ Ошибка при запуске задачи.");
        }
        return;
      }

      // ------------------------ STOP TASKS BY TYPE -----------------------
      case "/stop_tasks_type": {
        // ✅ критическая команда — только монарх
        if (!bypass) {
          await bot.sendMessage(
            chatId,
            "Эта команда доступна только монарху GARYA."
          );
          return;
        }

        const taskType = (rest || "").trim();
        if (!taskType) {
          await bot.sendMessage(
            chatId,
            'Использование: /stop_tasks_type <type>\nНапример: /stop_tasks_type price_monitor'
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
          await bot.sendMessage(
            chatId,
            "⚠️ Ошибка при остановке задач по типу."
          );
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

        await bot.sendMessage(
          chatId,
          JSON.stringify(result, null, 2).slice(0, 3500)
        );
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
                res.error
                  ? `Ошибка: <code>${res.error}</code>`
                  : "Неизвестная ошибка",
              ].join("\n"),
              { parse_mode: "HTML" }
            );
            return;
          }

          await bot.sendMessage(
            chatId,
            [
              `Диагностика <code>${key}</code>: ✅ OK`,
              res.httpStatus
                ? `HTTP статус: <code>${res.httpStatus}</code>`
                : "HTTP статус: n/a",
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

      // --------------------------- 5.7.3 /test_source ---------------------
      case "/test_source": {
        const key = (rest || "").trim();
        if (!key) {
          await bot.sendMessage(
            chatId,
            "Использование: /test_source <key>\nПример: /test_source coingecko_simple_price",
            { parse_mode: "HTML" }
          );
          return;
        }

        try {
          const res = await testSource(key, {
            userRole,
            userPlan,
            bypassPermissions: bypass,
            ignoreRateLimit: false,
          });

          if (
            !res.ok &&
            (res.reason === "rate_limited" || res.httpStatus === 429)
          ) {
            await bot.sendMessage(
              chatId,
              [
                `TEST <code>${key}</code>: ⚠️ <b>RATE LIMIT</b>`,
                "HTTP: <code>429</code>",
                "Попробуй через 60–120 секунд.",
              ].join("\n"),
              { parse_mode: "HTML" }
            );
            return;
          }

          if (!res.ok) {
            await bot.sendMessage(
              chatId,
              [
                `TEST <code>${key}</code>: ❌`,
                res.httpStatus
                  ? `HTTP: <code>${res.httpStatus}</code>`
                  : "HTTP: n/a",
                res.type ? `type: <code>${res.type}</code>` : "",
                res.reason ? `reason: <code>${res.reason}</code>` : "",
                res.error
                  ? `Ошибка: <code>${res.error}</code>`
                  : "Ошибка: <code>Unknown</code>",
              ]
                .filter(Boolean)
                .join("\n"),
              { parse_mode: "HTML" }
            );
            return;
          }

          await bot.sendMessage(
            chatId,
            [
              `TEST <code>${key}</code>: ✅ OK`,
              res.httpStatus
                ? `HTTP: <code>${res.httpStatus}</code>`
                : "HTTP: n/a",
              res.type ? `type: <code>${res.type}</code>` : "",
              typeof res.latencyMs === "number"
                ? `latency: <code>${res.latencyMs}ms</code>`
                : "",
              typeof res.bytes === "number"
                ? `bytes: <code>${res.bytes}</code>`
                : "",
              `cache: <code>${res.fromCache ? "yes" : "no"}</code>`,
            ]
              .filter(Boolean)
              .join("\n"),
            { parse_mode: "HTML" }
          );
        } catch (err) {
          console.error("❌ /test_source error:", err);
          await bot.sendMessage(
            chatId,
            `TEST ошибка: <code>${err?.message || err}</code>`,
            { parse_mode: "HTML" }
          );
        }

        return;
      }

      // --------------------------- /price (CoinGecko) --------------------
      case "/price": {
        const coinId = (rest || "").trim().toLowerCase();
        if (!coinId) {
          await bot.sendMessage(
            chatId,
            "Использование: /price <coinId>\nПример: /price bitcoin"
          );
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
            await bot.sendMessage(
              chatId,
              "⚠️ CoinGecko вернул лимит (HTTP 429). Попробуй ещё раз через 1–2 минуты."
            );
          } else {
            await bot.sendMessage(chatId, `❌ Ошибка: ${result.error}`);
          }
          return;
        }

        await bot.sendMessage(
          chatId,
          `💰 ${result.id.toUpperCase()}: $${result.price}`
        );
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
            await bot.sendMessage(
              chatId,
              "⚠️ CoinGecko вернул лимит (HTTP 429). Попробуй ещё раз через 1–2 минуты."
            );
          } else {
            await bot.sendMessage(chatId, `❌ Ошибка: ${result.error}`);
          }
          return;
        }

        let out = "💰 Цены (CoinGecko, USD):\n\n";
        for (const id of ids) {
          const item = result.items?.[id];
          out += item
            ? `• ${item.id.toUpperCase()}: $${item.price}\n`
            : `• ${id.toUpperCase()}: нет данных\n`;
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
            `🧠 Project Memory: ${rec.section}\n\n${String(rec.content || "").slice(
              0,
              3500
            )}`
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
          await bot.sendMessage(
            chatId,
            "Использование: /mode short | normal | long"
          );
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
        directReplyText: Boolean(trimmed)
          ? null
          : "Напиши текстом, что нужно сделать.",
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
      meta: {
        caption: mediaSummary.caption || null,
        phase: "before_reply_or_ai",
      },
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

  const systemPrompt = buildSystemPrompt(
    answerMode,
    modeInstruction,
    projectCtx || ""
  );
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

/**
 * Health check and diagnostic function
 * @returns {object} System status information
 */
function getSystemHealth() {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  const uptimeMinutes = Math.floor(uptime / 60);
  const uptimeSeconds = Math.floor(uptime % 60);
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  
  return {
    status: "operational",
    uptime: `${uptimeMinutes}m ${uptimeSeconds}s`,
    memory: {
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
    },
    timestamp: new Date().toISOString(),
  };
}
