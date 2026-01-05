// ============================================================================
// === src/bot/messageRouter.js — MAIN HANDLER extracted from index.js ===
// ============================================================================

import { handleSourcesList } from "./handlers/sourcesList.js";

import { handleTasksList } from "./handlers/tasksList.js";

import { handleStartTask } from "./handlers/startTask.js";

import { handleStopTask } from "./handlers/stopTask.js";

import { handleSourcesDiag } from "./handlers/sources_diag.js";

import { handleSource } from "./handlers/source.js";

import { handleRunTask } from "./handlers/runTask.js";

import { handleNewTask } from "./handlers/newTask.js";

import { handleBtcTestTask } from "./handlers/btcTestTask.js";

import { handleDemoTask } from "./handlers/demoTask.js";

import { handleStopAllTasks } from "./handlers/stopAllTasks.js";

import { handleFileLogs } from "./handlers/fileLogs.js";

import { handleArList } from "./handlers/arList.js";

import { handleDeny } from "./handlers/deny.js";

import { handleApprove } from "./handlers/approve.js";

import { approveAndNotify, denyAndNotify, listAccessRequests } from "../users/accessRequests.js";

import { resolveUserAccess } from "../users/userAccess.js";

import pool from "../../db.js";

import { dispatchCommand } from "./commandDispatcher.js";

// === CORE ===
import { getAnswerMode, setAnswerMode } from "../../core/answerMode.js";
import { loadProjectContext } from "../../core/projectContext.js";
import { buildSystemPrompt } from "../../systemPrompt.js";

import {
  parseCommand,
  firstWordAndRest,
  callWithFallback,
  isOwnerTaskRow,
  canStopTaskV1,
  sanitizeNonMonarchReply,
} from "../../core/helpers.js";

// === MEMORY ===
import {
  getChatHistory,
  saveMessageToMemory,
  saveChatPair,
} from "../memory/chatMemory.js";

// === USERS ===
import { ensureUserProfile } from "../users/userProfile.js";
import { buildRequirePermOrReply } from "./permGuard.js";

// === TASK ENGINE ===
import {
  createDemoTask,
  createManualTask,
  createTestPriceMonitorTask,
  getUserTasks,
  getTaskById,
  runTaskWithAI,
  updateTaskStatus,
} from "../tasks/taskEngine.js";

// === SOURCES LAYER ===
import {
  runSourceDiagnosticsOnce,
  getAllSourcesSafe,
  fetchFromSourceKey,
  formatSourcesList,
  diagnoseSource,
  testSource,
} from "../sources/sources.js";

// === COINGECKO (V1 SIMPLE PRICE) ===
import {
  getCoinGeckoSimplePriceById,
  getCoinGeckoSimplePriceMulti,
} from "../sources/coingecko/index.js";

// === FILE-INTAKE / MEDIA ===
import * as FileIntake from "../media/fileIntake.js";

// === LOGGING (interaction_logs) ===
import { logInteraction } from "../logging/interactionLogs.js";

// === AI ===
import { callAI } from "../../ai.js";

// === PROJECT MEMORY ===
import { getProjectSection, upsertProjectSection } from "../../projectMemory.js";

// ----------------------------------------------------------------------------
// Fallback helpers (чтобы не падать из-за отсутствующих импортов)
// ----------------------------------------------------------------------------
async function getRecentFileIntakeLogs(chatIdStr, n = 10) {
  const limit = Math.max(1, Math.min(Number(n) || 10, 30));
  const res = await pool.query(
    `
    SELECT *
    FROM file_intake_logs
    WHERE chat_id = $1
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [chatIdStr, limit]
  );
  return res.rows || [];
}

async function getTaskRowById(id) {
  const res = await pool.query(`SELECT * FROM tasks WHERE id = $1 LIMIT 1`, [
    Number(id),
  ]);
  return res.rows?.[0] || null;
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------
export function attachMessageRouter({
  bot,
  MONARCH_CHAT_ID,
  DEFAULT_PLAN = "free",
  MAX_HISTORY_MESSAGES = 20,
}) {
  function isMonarch(chatIdStr) {
    return String(chatIdStr) === String(MONARCH_CHAT_ID);
  }

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const chatIdStr = chatId.toString();

    const senderId = msg.from?.id;
    const senderIdStr = senderId?.toString() || "";

    const text = msg.text || "";
    const trimmed = text.trim();

    // 0) User profile
    await ensureUserProfile(msg);

    const { userRole, userPlan, bypass, access, user } = await resolveUserAccess({
      chatIdStr,
      senderIdStr,
      DEFAULT_PLAN,
      isMonarch,
    });

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
      "/test_source": "cmd.source.test",

      "/stop_all_tasks": "cmd.admin.stop_all_tasks",
      "/start_task": "cmd.admin.start_task",
      "/stop_tasks_type": "cmd.admin.stop_tasks_type",
      "/users_stats": "cmd.admin.users_stats",
      "/file_logs": "cmd.admin.file_logs",
      "/pm_set": "cmd.admin.pm_set",

      "/ar_create_test": "cmd.admin.ar_create_test",
      "/ar_list": "cmd.admin.ar_list",
    };

    // ✅ Вынесено в src/bot/permGuard.js без изменения логики
    const requirePermOrReply = buildRequirePermOrReply({
      bot,
      msg,
      MONARCH_CHAT_ID,
      user,
      userRole,
      userPlan,
      trimmed,
      CMD_ACTION,
    });

    // ======================================================================
    // === COMMANDS ===
    // ======================================================================
    if (trimmed.startsWith("/")) {
      const parsed = parseCommand(trimmed);
      const cmd = parsed?.cmd || trimmed.split(" ")[0];
      const rest = parsed?.rest || "";

      if (!(await requirePermOrReply(cmd, { rest }))) return;

      // === COMMAND DISPATCHER (SKELETON) ===
const dispatchResult = await dispatchCommand(cmd, {
  bot,
  msg,
  chatId,
  chatIdStr,
  senderIdStr,
  userRole,
  userPlan,
  bypass,
  access,
  user,
  rest,
  getCoinGeckoSimplePriceById,
  getCoinGeckoSimplePriceMulti,
  getAnswerMode,
  setAnswerMode,
  handleHelpLegacy: async () => {
    await bot.sendMessage(chatId, "Используй /help (legacy).");
  },
  requirePermOrReply,
  DEFAULT_PLAN,
  MONARCH_CHAT_ID,
});

if (dispatchResult?.handled) {
  return;
}

      switch (cmd) {

          case "/approve": {
  await handleApprove({
    bot,
    chatId,
    chatIdStr,
    rest,
    bypass,
  });
  return;
}

          case "/deny": {
  await handleDeny({
    bot,
    chatId,
    chatIdStr,
    rest,
    bypass,
  });
  return;
}

        case "/ar_create_test": {
          if (!bypass) {
            await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
            return;
          }

          try {
            const nowIso = new Date().toISOString();

            const reqRow = await AccessRequests.createAccessRequest({
              requesterChatId: chatIdStr,
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

          case "/ar_list": {
  await handleArList({
    bot,
    chatId,
    rest,
    bypass,
  });
  return;
}

                  case "/file_logs": {
          await handleFileLogs({
            bot,
            chatId,
            chatIdStr,
            rest,
            bypass,
          });
          return;
        }

        case "/demo_task": {
          await handleDemoTask({
            bot,
            chatId,
            chatIdStr,
            createDemoTask,
          });
          return;
        }

        case "/btc_test_task": {
          await handleBtcTestTask({
            bot,
            chatId,
            chatIdStr,
            access,
            callWithFallback,
            createTestPriceMonitorTask,
          });
          return;
        }

        case "/newtask": {
          await handleNewTask({
            bot,
            chatId,
            chatIdStr,
            rest,
            access,
            callWithFallback,
            createManualTask,
          });
          return;
        }

        case "/run": {
          await handleRunTask({
            bot,
            chatId,
            chatIdStr,
            rest,
            access,
            callWithFallback,
            runTask,
          });
          return;
        }

case "/tasks": {
  await handleTasksList({
    bot,
    chatId,
    chatIdStr,
    getUserTasks,
    access,
  });
  return;
}

case "/stop_task": {
  await handleStopTask({
    bot,
    chatId,
    chatIdStr,
    rest,
    userRole,
    bypass,
    getTaskRowById,
    isOwnerTaskRow,
    canStopTaskV1,
    updateTaskStatus,
  });
  return;
}

case "/start_task": {
  await handleStartTask({
    bot,
    chatId,
    rest,
    bypass,
    updateTaskStatus,
  });
  return;
}

case "/sources": {
  await handleSourcesList({
    bot,
    chatId,
    userRole,
    userPlan,
    bypass,
    listSources,
  });
  return;
}

case "/sources_diag": {
  await handleSourcesDiag({
    bot,
    chatId,
    userRole,
    userPlan,
    bypass,
    runSourceDiagnosticsOnce,
  });
  return;
}

case "/source": {
  await handleSource({
    bot,
    msg,
    chatId,
    chatIdStr,
    rest,
    access,
    userRole,
    userPlan,
    bypass,
  });
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

            if (!res.ok && (res.reason === "rate_limited" || res.httpStatus === 429)) {
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
                  res.httpStatus ? `HTTP: <code>${res.httpStatus}</code>` : "HTTP: n/a",
                  res.type ? `type: <code>${res.type}</code>` : "",
                  res.reason ? `reason: <code>${res.reason}</code>` : "",
                  res.error ? `Ошибка: <code>${res.error}</code>` : "Ошибка: <code>Unknown</code>",
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
                res.httpStatus ? `HTTP: <code>${res.httpStatus}</code>` : "HTTP: n/a",
                res.type ? `type: <code>${res.type}</code>` : "",
                typeof res.latencyMs === "number" ? `latency: <code>${res.latencyMs}ms</code>` : "",
                typeof res.bytes === "number" ? `bytes: <code>${res.bytes}</code>` : "",
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

    // ======================================================================
    // === NOT COMMANDS: FILE-INTAKE + MEMORY + CONTEXT + AI ===
    // ======================================================================
    const messageId = msg.message_id ?? null;

    const summarizeMediaAttachment =
      typeof FileIntake.summarizeMediaAttachment === "function"
        ? FileIntake.summarizeMediaAttachment
        : () => null;

    const mediaSummary = summarizeMediaAttachment(msg);

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

    if (directReplyText) {
      await bot.sendMessage(chatId, directReplyText);
      return;
    }

    if (!shouldCallAI) {
      await bot.sendMessage(chatId, "Напиши текстом, что нужно сделать.");
      return;
    }

    await saveMessageToMemory(chatIdStr, "user", effective);
    const history = await getChatHistory(chatIdStr, MAX_HISTORY_MESSAGES);

    const classification = { taskType: "chat", aiCostLevel: "low" };
    await logInteraction(chatIdStr, classification);

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

    const currentUserName =
      [msg?.from?.first_name, msg?.from?.last_name].filter(Boolean).join(" ").trim() ||
      (msg?.from?.username ? `@${msg.from.username}` : "пользователь");

    const systemPrompt = buildSystemPrompt(
      answerMode,
      modeInstruction,
      projectCtx || "",
      { isMonarch: isMonarch(senderIdStr), currentUserName }
    );

    const roleGuardPrompt = bypass
      ? "SYSTEM ROLE: текущий пользователь = MONARCH (разрешено обращаться 'Монарх', 'Гарик')."
      : "SYSTEM ROLE: текущий пользователь НЕ монарх. Запрещено обращаться 'Монарх', 'Ваше Величество', 'Государь'. Называй: 'гость' или нейтрально (вы/ты).";

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "system", content: roleGuardPrompt },
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

    await saveChatPair(chatIdStr, effective, aiReply);

    try {
      if (!bypass) aiReply = sanitizeNonMonarchReply(aiReply);
      await bot.sendMessage(chatId, aiReply);
    } catch (e) {
      console.error("❌ Telegram send error:", e);
    }
  });
}
