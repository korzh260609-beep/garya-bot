// docs/legacy/commands.legacy.js
//
// ⚠️ LEGACY / NOT AUTHORITATIVE
//
// Этот файл содержит старую командную логику и оставлен
// только как исторический reference / fallback-material.
//
// Актуальные authoritative runtime paths сейчас:
// - src/bot/messageRouter.js
// - src/bot/commandDispatcher.js
// - index.js wiring
//
// ВАЖНО:
// - не использовать этот файл как источник текущей архитектуры
// - не копировать из него логику без проверки по runtime path
// - не считать этот файл активным роутером команд
//
// Причина сохранения:
// - historical reference
// - старые шаблоны/паттерны для сравнения
// - безопаснее пометить, чем удалять вслепую
//
// Если позже будет принято решение:
// - либо удалить файл отдельным шагом после полной проверки импортов
// - либо перенести в docs/legacy/
// - либо оставить как архив, но уже вне active src-path

import pool from "../db.js";
import * as Sources from "../sources.js";

import {
  createDemoTask,
  createManualTask,
  createTestPriceMonitorTask,
  getUserTasks,
  getTaskById,
  updateTaskStatus,
  runTaskWithAI,
} from "../tasks/taskEngine.js";

import { getAllSourcesSafe, formatSourcesList } from "../sources/sourcesDebug.js";

import { getProjectSection, upsertProjectSection } from "../projectMemory.js";
import { setAnswerMode } from "../core/answerMode.js";

// ============================================================================
// === Identity-first helpers (Stage 4)
// ============================================================================

async function resolveGlobalUserId({ senderIdStr, chatIdStr }) {
  const providerUserId = String(senderIdStr || "").trim();
  let globalUserId = null;

  // 1) identity-first
  if (providerUserId) {
    try {
      const idRes = await pool.query(
        `
        SELECT global_user_id
        FROM user_identities
        WHERE provider = 'telegram' AND provider_user_id = $1
        LIMIT 1
        `,
        [providerUserId]
      );
      globalUserId = idRes.rows?.[0]?.global_user_id || null;
    } catch (e) {
      console.error("❌ resolveGlobalUserId identity query error:", e);
    }
  }

  // 2) legacy fallback
  if (!globalUserId && providerUserId) {
    try {
      const legacyRes = await pool.query(
        `
        SELECT global_user_id
        FROM users
        WHERE global_user_id = $1 OR tg_user_id = $2
        LIMIT 1
        `,
        [`tg:${providerUserId}`, providerUserId]
      );
      globalUserId = legacyRes.rows?.[0]?.global_user_id || null;
    } catch (e) {
      console.error("❌ resolveGlobalUserId legacy query error:", e);
    }
  }

  // 3) last fallback (transport chat_id only)
  if (!globalUserId && chatIdStr) {
    try {
      const transportRes = await pool.query(
        `
        SELECT global_user_id
        FROM users
        WHERE chat_id = $1
        LIMIT 1
        `,
        [String(chatIdStr)]
      );
      globalUserId = transportRes.rows?.[0]?.global_user_id || null;
    } catch (e) {
      console.error("❌ resolveGlobalUserId transport query error:", e);
    }
  }

  return globalUserId;
}

async function buildAccessContext({ senderIdStr, chatIdStr }) {
  const globalUserId = await resolveGlobalUserId({ senderIdStr, chatIdStr });

  // role/plan берём из users (plan пока безопасно фиксируем как free, чтобы не ссылаться на несуществующую колонку)
  let role = "guest";

  if (globalUserId) {
    try {
      const uRes = await pool.query(
        `
        SELECT role
        FROM users
        WHERE global_user_id = $1
        LIMIT 1
        `,
        [globalUserId]
      );
      role = (uRes.rows?.[0]?.role || "guest").toLowerCase();
    } catch (e) {
      console.error("❌ buildAccessContext user query error:", e);
    }
  }

  return {
    userRole: role,
    userPlan: "free",
    user: { global_user_id: globalUserId || null },
  };
}

// ============================================================================
// === Access Requests helpers/commands (extracted pattern from messageRouter.js)
// ============================================================================

// ---------------------------------------------------------------------------
// Permission guard (monarch-only) — Stage 4: identity-first (MONARCH_USER_ID)
// ---------------------------------------------------------------------------
async function requireMonarch(bot, chatId, senderIdStr) {
  const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "").trim();
  if (!MONARCH_USER_ID) return true;

  if (!senderIdStr) {
    await bot.sendMessage(
      chatId,
      "Internal error: senderIdStr missing (identity-first)."
    );
    return false;
  }

  if (String(senderIdStr) !== MONARCH_USER_ID) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return false;
  }
  return true;
}

async function getUserRoleBySenderId(senderIdStr, chatIdStr) {
  try {
    const globalUserId = await resolveGlobalUserId({ senderIdStr, chatIdStr });
    if (!globalUserId) return "guest";

    const res = await pool.query(
      "SELECT role FROM users WHERE global_user_id = $1",
      [globalUserId]
    );
    return res.rows?.[0]?.role || "guest";
  } catch (e) {
    console.error("❌ Error fetching user role:", e);
    return "guest";
  }
}

async function cmdApprove({ bot, chatId, chatIdStr, senderIdStr, rest }) {
  const ok = await requireMonarch(bot, chatId, senderIdStr);
  if (!ok) return;

  const id = Number((rest || "").trim());
  if (!id) {
    await bot.sendMessage(chatId, "Использование: /approve <request_id>");
    return;
  }

  try {
    const AccessRequests = await import("../users/accessRequests.js");
    const result = await AccessRequests.approveAccessRequest({
      requestId: id,
      resolvedBy: String(senderIdStr),
    });

    if (!result?.ok) {
      await bot.sendMessage(
        chatId,
        `⚠️ Не удалось approve: ${result?.error || "unknown"}`
      );
      return;
    }

    const req =
      result.request || result.row || result.data || result.accessRequest || null;

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
      } catch {
        // ignore
      }
    }

    await bot.sendMessage(chatId, `✅ Заявка #${id} одобрена.`);
  } catch (e) {
    console.error("❌ /approve error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка при approve.");
  }
}

async function cmdDeny({ bot, chatId, chatIdStr, senderIdStr, rest }) {
  const ok = await requireMonarch(bot, chatId, senderIdStr);
  if (!ok) return;

  const id = Number((rest || "").trim());
  if (!id) {
    await bot.sendMessage(chatId, "Использование: /deny <request_id>");
    return;
  }

  try {
    const AccessRequests = await import("../users/accessRequests.js");
    const result = await AccessRequests.denyAccessRequest({
      requestId: id,
      resolvedBy: String(senderIdStr),
    });

    if (!result?.ok) {
      await bot.sendMessage(
        chatId,
        `⚠️ Не удалось deny: ${result?.error || "unknown"}`
      );
      return;
    }

    const req =
      result.request || result.row || result.data || result.accessRequest || null;

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
      } catch {
        // ignore
      }
    }

    await bot.sendMessage(chatId, `⛔ Заявка #${id} отклонена.`);
  } catch (e) {
    console.error("❌ /deny error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка при deny.");
  }
}

async function cmdArCreateTest({ bot, chatId, chatIdStr, senderIdStr }) {
  const ok = await requireMonarch(bot, chatId, senderIdStr);
  if (!ok) return;

  try {
    const AccessRequests = await import("../users/accessRequests.js");
    const nowIso = new Date().toISOString();
    const userRole = await getUserRoleBySenderId(senderIdStr, chatIdStr);

    const reqRow = await AccessRequests.createAccessRequest({
      requesterChatId: chatIdStr,
      requesterName: "MONARCH_SELF_TEST",
      requesterRole: userRole,
      requestedAction: "cmd.admin.stop_all_tasks",
      requestedCmd: "/stop_all_tasks",
      meta: {
        test: true,
        createdBy: String(senderIdStr),
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
}

async function cmdArList({ bot, chatId, chatIdStr, senderIdStr, rest }) {
  const ok = await requireMonarch(bot, chatId, senderIdStr);
  if (!ok) return;

  const n = Math.max(1, Math.min(Number((rest || "").trim()) || 10, 30));

  try {
    const res = await pool.query(
      `
      SELECT
                 ar.id,
        COALESCE(ar.status, 'pending') AS status,
        COALESCE(ar.requester_chat_id, ar.chat_id, ar.user_chat_id) AS requester_chat_id,
        COALESCE(ar.requester_name, '') AS requester_name,
        COALESCE(ar.requester_role, '') AS requester_role,
        COALESCE(ar.requested_action, ar.requestedAction, '') AS requested_action,
        COALESCE(ar.requested_cmd, ar.requestedCmd, '') AS requested_cmd,
        ar.created_at,
        COALESCE(u.role, 'unknown') AS current_role
      FROM access_requests ar
      LEFT JOIN LATERAL (
        SELECT role
        FROM users
        WHERE tg_user_id = COALESCE(ar.requester_chat_id, ar.chat_id, ar.user_chat_id)
           OR chat_id = COALESCE(ar.requester_chat_id, ar.chat_id, ar.user_chat_id)
        ORDER BY (tg_user_id = COALESCE(ar.requester_chat_id, ar.chat_id, ar.user_chat_id)) DESC
        LIMIT 1
      ) u ON TRUE
      ORDER BY ar.created_at DESC
      LIMIT $1
      `,
      [n]
    );

    if (!res.rows?.length) {
      await bot.sendMessage(chatId, "🛡️ access_requests пусто.");
      return;
    }

    let out =
      `🛡️ Access Requests (last ${res.rows.length})\n` +
      `ℹ️ role_at_request = historical snapshot, current_role = current profile role\n\n`;
    for (const r of res.rows) {
      out += `#${r.id} | ${r.status} | ${new Date(r.created_at).toISOString()}\n`;
      out += `who=${r.requester_chat_id}${
        r.requester_name ? ` (${r.requester_name})` : ""
      }\n`;
      if (r.requester_role) out += `role_at_request=${r.requester_role}\n`;
      out += `current_role=${r.current_role}\n`;
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
}

// ============================================================================
// === ADMIN: STOP ALL TASKS (monarch-only) ===
// ============================================================================

async function cmdStopAllTasks({ bot, chatId, senderIdStr }) {
  const ok = await requireMonarch(bot, chatId, senderIdStr);
  if (!ok) return;

  try {
    // before counts
    const beforeRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')::int  AS active_count,
        COUNT(*) FILTER (WHERE status = 'paused')::int  AS paused_count,
        COUNT(*) FILTER (WHERE status = 'stopped')::int AS stopped_count,
        COUNT(*) FILTER (WHERE status = 'deleted')::int AS deleted_count,
        COUNT(*)::int AS total
      FROM tasks
    `);

    const b = beforeRes.rows?.[0] || {};
    const activeBefore = Number(b.active_count || 0);
    const pausedBefore = Number(b.paused_count || 0);

    // stop everything except deleted
    const upd = await pool.query(
      `
      UPDATE tasks
      SET status = 'stopped'
      WHERE status <> 'deleted'
      RETURNING id
      `
    );

    // after counts
    const afterRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')::int  AS active_count,
        COUNT(*) FILTER (WHERE status = 'paused')::int  AS paused_count,
        COUNT(*) FILTER (WHERE status = 'stopped')::int AS stopped_count,
        COUNT(*) FILTER (WHERE status = 'deleted')::int AS deleted_count,
        COUNT(*)::int AS total
      FROM tasks
    `);

    const a = afterRes.rows?.[0] || {};
    const stoppedAfter = Number(a.stopped_count || 0);

    await bot.sendMessage(
      chatId,
      [
        "🛑 STOP ALL TASKS",
        `updated: ${upd.rowCount || 0}`,
        `before: active=${activeBefore}, paused=${pausedBefore}`,
        `after: stopped=${stoppedAfter}`,
        "",
        "⚠️ Если логи продолжаются — значит robotTick НЕ фильтрует status='active'. Тогда правим robotMock/worker.",
      ].join("\n")
    );
  } catch (e) {
    console.error("❌ /stop_all_tasks error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка при остановке задач. См. логи сервера.");
  }
}

// Главный обработчик текстовых команд.
// LEGACY ONLY. NOT AUTHORITATIVE RUNTIME PATH.
export async function handleCommand(bot, msg, command, commandArgs) {
  const chatId = msg.chat.id;
  const chatIdStr = chatId.toString();

  // Stage 4: identity-first. chat_id = transport only.
  const senderIdStr = msg?.from?.id != null ? String(msg.from.id) : "";

  // access context for TaskEngine (identity-first)
  const access = await buildAccessContext({ senderIdStr, chatIdStr });

  switch (command) {
    case "/profile":
    case "/whoami":
    case "/me": {
      try {
        const globalUserId = access?.user?.global_user_id || null;

        if (!globalUserId) {
          await bot.sendMessage(chatId, "Профиль не найден.");
          return;
        }

        const res = await pool.query(
          "SELECT chat_id, global_user_id, name, role, language, created_at FROM users WHERE global_user_id = $1 LIMIT 1",
          [globalUserId]
        );

        if (res.rows.length === 0) {
          await bot.sendMessage(chatId, "Профиль не найден.");
        } else {
          const u = res.rows[0];
          const text =
            `🧾 Профиль пользователя\n` +
            `chat_id (transport): \`${u.chat_id || "—"}\`\n` +
            `global_user_id: \`${u.global_user_id || "—"}\`\n` +
            `Имя: ${u.name || "—"}\n` +
            `Роль: ${u.role || "—"}\n` +
            `Язык: ${u.language || "—"}\n` +
            `Создан: ${u.created_at?.toISOString?.() || "—"}`;

          await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
        }
      } catch (e) {
        console.error("❌ Error in /profile:", e);
        await bot.sendMessage(chatId, "Не удалось прочитать профиль пользователя.");
      }
      return;
    }

    case "/approve": {
      await cmdApprove({ bot, chatId, chatIdStr, senderIdStr, rest: commandArgs });
      return;
    }

    case "/deny": {
      await cmdDeny({ bot, chatId, chatIdStr, senderIdStr, rest: commandArgs });
      return;
    }

    case "/ar_create_test": {
      await cmdArCreateTest({ bot, chatId, chatIdStr, senderIdStr });
      return;
    }

    case "/ar_list": {
      await cmdArList({ bot, chatId, chatIdStr, senderIdStr, rest: commandArgs });
      return;
    }

    case "/stop_all_tasks": {
      await cmdStopAllTasks({ bot, chatId, senderIdStr });
      return;
    }

    case "/demo_task": {
      try {
        const id = await createDemoTask(chatIdStr, access);
        await bot.sendMessage(
          chatId,
          `✅ Демо-задача создана! ID: ${id}\n` +
            "Пока что это просто запись в таблице tasks. В будущем сюда прикрутим реальные отчёты/мониторинг."
        );
      } catch (e) {
        console.error("❌ Error in /demo_task:", e);
        await bot.sendMessage(chatId, "Не удалось создать демо-задачу. См. логи сервера.");
      }
      return;
    }

    case "/run": {
      const idStr = commandArgs.trim();
      if (!idStr) {
        await bot.sendMessage(chatId, "Нужно указать ID задачи. Пример: `/run 1`", {
          parse_mode: "Markdown",
        });
        return;
      }

      const taskId = Number(idStr);
      if (Number.isNaN(taskId)) {
        await bot.sendMessage(chatId, "ID задачи должен быть числом.");
        return;
      }

      try {
        const task = await getTaskById(chatIdStr, taskId, access);
        if (!task) {
          await bot.sendMessage(chatId, `Я не нашёл задачу #${taskId} среди ваших задач.`);
          return;
        }

        await bot.sendMessage(chatId, `🚀 Запускаю задачу #${task.id} через ИИ-движок...`);
        await runTaskWithAI(task, chatId, bot, access);
      } catch (e) {
        console.error("❌ Error in /run:", e);
        await bot.sendMessage(chatId, "Не удалось запустить задачу. См. логи сервера.");
      }
      return;
    }

    case "/btc_test_task": {
      try {
        const taskId = await createTestPriceMonitorTask(chatIdStr, access);
        await bot.sendMessage(
          chatId,
          `🆕 Тестовая задача мониторинга BTC создана!\n\n` +
            `#${taskId} — price_monitor\n` +
            `Статус: active\n` +
            `Описание: BTC monitor test (раз в час)\n` +
            `Расписание (cron): 0 * * * *\n`
        );
      } catch (e) {
        console.error("❌ Error in /btc_test_task:", e);
        await bot.sendMessage(chatId, "Не удалось создать тестовую задачу мониторинга BTC.");
      }
      return;
    }

    case "/newtask": {
      const taskText = commandArgs;
      if (!taskText) {
        await bot.sendMessage(
          chatId,
          "Нужно указать описание задачи.\n\nПример:\n`/newtask кратко опиши, что делать`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      try {
        const task = await createManualTask(chatIdStr, "Manual task", taskText, access);

        await bot.sendMessage(
          chatId,
          `🆕 Задача создана!\n\n` +
            `#${task.id} — manual\n` +
            `Статус: active\n` +
            `Описание: ${taskText}\n` +
            `Создана: ${task.created_at?.toISOString?.() || "—"}`
        );
      } catch (e) {
        console.error("❌ Error in /newtask:", e);
        await bot.sendMessage(chatId, "Не удалось создать задачу в Task Engine.");
      }
      return;
    }

    case "/tasks": {
      try {
        const tasks = await getUserTasks(chatIdStr, 30, access);
        if (!tasks || tasks.length === 0) {
          await bot.sendMessage(
            chatId,
            "У вас пока нет задач в Task Engine.\n" +
              "Создайте демо-задачу командой /demo_task или задачу вручную через /newtask."
          );
        } else {
          let text = "📋 Ваши задачи:\n\n";
          for (const t of tasks) {
            text +=
              `#${t.id} — ${t.title}\n` +
              `Тип: ${t.type}\n` +
              `Статус: ${t.status}\n` +
              `Создана: ${t.created_at?.toISOString?.() || "—"}\n` +
              (t.schedule ? `Расписание: ${t.schedule}\n` : "") +
              (t.last_run ? `Последний запуск: ${t.last_run.toISOString()}\n` : "") +
              `\n`;
          }
          await bot.sendMessage(chatId, text);
        }
      } catch (e) {
        console.error("❌ Error in /tasks:", e);
        await bot.sendMessage(chatId, "Не удалось получить список задач из Task Engine.");
      }
      return;
    }

    case "/task": {
      const raw = commandArgs.trim();

      if (!raw) {
        await bot.sendMessage(
          chatId,
          "Команда `/task` — работа с задачами Task Engine.\n\n" +
            "Варианты использования:\n" +
            "• `/task list` — показать список ваших задач\n" +
            "• `/task new <описание>` — создать новую задачу\n" +
            "• `/task pause <id>` — поставить задачу на паузу\n" +
            "• `/task resume <id>` — возобновить задачу\n" +
            "• `/task delete <id>` — пометить задачу как удалённую\n" +
            "• `/task <id>` — показать подробности по задаче\n",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const [first, ...restParts] = raw.split(" ");
      const firstLower = first.toLowerCase();
      const restText = restParts.join(" ").trim();

      if (firstLower === "list") {
        try {
          const tasks = await getUserTasks(chatIdStr, 50, access);
          if (!tasks || tasks.length === 0) {
            await bot.sendMessage(chatId, "У вас пока нет задач в Task Engine.");
          } else {
            let text = "📋 Ваши задачи:\n\n";
            for (const t of tasks) {
              text +=
                `#${t.id} — ${t.title}\n` +
                `Тип: ${t.type}\n` +
                `Статус: ${t.status}\n` +
                `Создана: ${t.created_at?.toISOString?.() || "—"}\n` +
                (t.schedule ? `Расписание: ${t.schedule}\n` : "") +
                (t.last_run ? `Последний запуск: ${t.last_run.toISOString()}\n` : "") +
                `\n`;
            }
            await bot.sendMessage(chatId, text);
          }
        } catch (e) {
          console.error("❌ Error in /task list:", e);
          await bot.sendMessage(chatId, "Не удалось получить список задач из Task Engine.");
        }
        return;
      }

      if (firstLower === "new") {
        if (!restText) {
          await bot.sendMessage(
            chatId,
            "Использование:\n`/task new <описание задачи>`\n\n" +
              "Пример:\n`/task new следи за ценой BTC раз в час`",
            { parse_mode: "Markdown" }
          );
          return;
        }

        try {
          const task = await createManualTask(chatIdStr, "Manual task", restText, access);

          await bot.sendMessage(
            chatId,
            `🆕 Задача создана!\n\n` +
              `#${task.id} — manual\n` +
              `Статус: active\n` +
              `Описание: ${restText}\n` +
              `Создана: ${task.created_at?.toISOString?.() || "—"}`
          );
        } catch (e) {
          console.error("❌ Error in /task new:", e);
          await bot.sendMessage(chatId, "Не удалось создать задачу в Task Engine.");
        }
        return;
      }

      if (firstLower === "pause" || firstLower === "resume" || firstLower === "delete") {
        if (!restText) {
          await bot.sendMessage(
            chatId,
            "Нужно указать ID задачи.\n\nПримеры:\n" +
              "`/task pause 10`\n" +
              "`/task resume 10`\n" +
              "`/task delete 10`",
            { parse_mode: "Markdown" }
          );
          return;
        }

        const taskId = Number(restText);
        if (Number.isNaN(taskId)) {
          await bot.sendMessage(chatId, "ID задачи должен быть числом.\nПример: `/task pause 10`", {
            parse_mode: "Markdown",
          });
          return;
        }

        try {
          const existing = await getTaskById(chatIdStr, taskId, access);
          if (!existing) {
            await bot.sendMessage(chatId, `Я не нашёл задачу #${taskId} среди ваших задач.`);
            return;
          }

          let newStatus = existing.status;
          let msgText = "";

          if (firstLower === "pause") {
            newStatus = "paused";
            msgText = `⏸ Задача #${taskId} поставлена на паузу.`;
          } else if (firstLower === "resume") {
            newStatus = "active";
            msgText = `▶️ Задача #${taskId} возобновлена.`;
          } else if (firstLower === "delete") {
            newStatus = "deleted";
            msgText = `🗑 Задача #${taskId} помечена как удалённая.`;
          }

          await updateTaskStatus(taskId, newStatus);
          await bot.sendMessage(chatId, msgText);
        } catch (e) {
          console.error("❌ Error in /task pause/resume/delete:", e);
          await bot.sendMessage(chatId, "Не удалось обновить статус задачи. См. логи сервера.");
        }
        return;
      }

      const taskId = Number(first);
      if (Number.isNaN(taskId)) {
        await bot.sendMessage(
          chatId,
          "Неизвестная подкоманда для /task. Используйте `list`, `new`, `pause`, `resume`, `delete` или ID задачи.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      try {
        const task = await getTaskById(chatIdStr, taskId, access);
        if (!task) {
          await bot.sendMessage(chatId, `Я не нашёл задачу #${taskId} среди ваших задач.`);
          return;
        }

        const text =
          `🔍 Задача #${task.id}\n\n` +
          `Название: ${task.title}\n` +
          `Тип: ${task.type}\n` +
          `Статус: ${task.status}\n` +
          `Создана: ${task.created_at?.toISOString?.() || "—"}\n` +
          (task.schedule ? `Расписание: ${task.schedule}\n` : "") +
          (task.last_run ? `Последний запуск: ${task.last_run.toISOString()}\n` : "") +
          `\n` +
          `Задачу можно запустить командой: \`/run ${task.id}\``;

        await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
      } catch (e) {
        console.error("❌ Error in /task <id>:", e);
        await bot.sendMessage(chatId, "Не удалось прочитать задачу. См. логи сервера.");
      }
      return;
    }

    case "/tasks_owner_diag": {
      const ok = await requireMonarch(bot, chatId, senderIdStr);
      if (!ok) return;

      try {
        const res = await pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE user_global_id IS NULL) AS null_count,
            COUNT(*) FILTER (WHERE user_global_id IS NOT NULL) AS filled_count,
            COUNT(*) AS total
          FROM tasks
        `);

        const row = res.rows?.[0] || {};
        const nullCount = Number(row.null_count || 0);
        const filledCount = Number(row.filled_count || 0);
        const total = Number(row.total || 0);

        await bot.sendMessage(
          chatId,
          [
            "🧪 TASKS OWNER DIAG",
            `total: ${total}`,
            `filled(user_global_id): ${filledCount}`,
            `null(user_global_id): ${nullCount}`,
          ].join("\n")
        );
      } catch (e) {
        console.error("❌ /tasks_owner_diag error:", e);
        await bot.sendMessage(chatId, "⚠️ Не удалось выполнить диагностику tasks (см. логи).");
      }

      return;
    }

    case "/sources": {
      try {
        const sources = await getAllSourcesSafe();
        const text = formatSourcesList(sources);
        await bot.sendMessage(chatId, text);
      } catch (e) {
        console.error("❌ Error in /sources:", e);
        await bot.sendMessage(chatId, "Не удалось получить список источников.");
      }
      return;
    }

    case "/sources_diag": {
      try {
        const summary = await Sources.runSourceDiagnosticsOnce();

        const lines = [];
        lines.push("🩺 Диагностика всех активных источников:");
        lines.push(`Всего: ${summary.total}`);
        lines.push(`OK: ${summary.okCount}`);
        lines.push(`С ошибками: ${summary.failCount}`);

        if (summary.failCount > 0) {
          lines.push("");
          lines.push("Проблемные источники:");
          for (const item of summary.items) {
            if (item.ok) continue;
            lines.push(`- ${item.key}: ${item.error || "неизвестная ошибка"}`);
          }
        }

        await bot.sendMessage(chatId, lines.join("\n"));
      } catch (e) {
        console.error("❌ Error in /sources_diag:", e);
        await bot.sendMessage(chatId, "❌ Ошибка при диагностике источников. См. логи сервера.");
      }
      return;
    }

    case "/source": {
      const key = commandArgs.trim();
      if (!key) {
        await bot.sendMessage(
          chatId,
          "Нужно указать ключ источника.\nПример: `/source coingecko_simple_price`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      try {
        const result = await Sources.fetchFromSourceKey(key);
        const ok = !!result && result.ok !== false;

        if (!ok) {
          const msgLines = [];
          msgLines.push(`❌ Источник "${key}" вернул ошибку.`);
          if (result && result.error) {
            msgLines.push("");
            msgLines.push(`Ошибка: ${result.error}`);
          }
          await bot.sendMessage(chatId, msgLines.join("\n"));
          return;
        }

        const payload =
          result.data || result.htmlSnippet || result.xmlSnippet || result.items || null;

        const previewObj = {
          ok: result.ok,
          sourceKey: result.sourceKey || key,
          type: result.type || "unknown",
          payload,
        };

        const preview = JSON.stringify(previewObj, null, 2).slice(0, 900);

        const text =
          `✅ Источник "${previewObj.sourceKey}" отработал успешно.\n\n` +
          `Тип: ${previewObj.type}\n\n` +
          `📄 Предпросмотр данных (обрезано):\n` +
          preview;

        await bot.sendMessage(chatId, text);
      } catch (e) {
        console.error("❌ Error in /source:", e);
        await bot.sendMessage(
          chatId,
          `❌ Внутренняя ошибка при работе с источником "${key}": ${e.message}`
        );
      }
      return;
    }

    case "/diag_source": {
      const key = commandArgs.trim();
      if (!key) {
        await bot.sendMessage(
          chatId,
          "Нужно указать ключ источника.\nПример: `/diag_source coingecko_simple_price`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      try {
        const result = await Sources.fetchFromSourceKey(key, { diag: true });
        const ok = !!result && result.ok !== false;

        const type = result.type || "unknown";
        const httpStatus =
          typeof result.httpStatus === "number"
            ? result.httpStatus
            : result.meta?.httpStatus ?? "—";

        const payload =
          result.data || result.htmlSnippet || result.xmlSnippet || result.items || null;

        const previewObj = {
          ok: result.ok,
          sourceKey: result.sourceKey || key,
          type,
          httpStatus,
          payload,
        };

        const preview = JSON.stringify(previewObj, null, 2).slice(0, 900);

        const text =
          `✅ Ответ от источника "${previewObj.sourceKey}".\n\n` +
          `Тип: ${type}\n` +
          `HTTP статус: ${httpStatus}\n\n` +
          `📄 Предпросмотр данных (обрезано):\n` +
          preview;

        await bot.sendMessage(chatId, text);
      } catch (e) {
        console.error("❌ Error in /diag_source:", e);
        await bot.sendMessage(
          chatId,
          `❌ Внутренняя ошибка при диагностике источника "${key}": ${e.message}`
        );
      }

      return;
    }

    case "/test_source": {
      return;
    }

    case "/pm_set": {
      const ok = await requireMonarch(bot, chatId, senderIdStr);
      if (!ok) return;

      const raw = commandArgs.trim();
      if (!raw) {
        await bot.sendMessage(
          chatId,
          "Использование:\n`/pm_set <section> <text>`\n\n" +
            "Пример:\n`/pm_set roadmap SG — ROADMAP V3.2 ...`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const firstSpace = raw.indexOf(" ");
      const section = firstSpace === -1 ? raw : raw.slice(0, firstSpace).trim();
      const content = firstSpace === -1 ? "" : raw.slice(firstSpace + 1).trim();

      if (!section) {
        await bot.sendMessage(chatId, "Нужно указать секцию. Пример:\n`/pm_set roadmap ...текст...`", {
          parse_mode: "Markdown",
        });
        return;
      }

      if (!content) {
        await bot.sendMessage(
          chatId,
          "Нужно указать текст для записи в проектную память.\n" +
            "Пример:\n`/pm_set roadmap ROADMAP V1.5 ...`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      try {
        const title = `Section: ${section}`;
        const meta = { section };

        await upsertProjectSection(undefined, section, title, content, meta);

        await bot.sendMessage(
          chatId,
          `✅ Проектная память обновлена для секции "${section}".\n\n` +
            `Длина текста: ${content.length} символов.`
        );
      } catch (e) {
        console.error("❌ /pm_set error:", e);
        await bot.sendMessage(chatId, "Не удалось обновить проектную память. См. логи сервера.");
      }

      return;
    }

    case "/pm_show": {
      const raw = commandArgs.trim();
      if (!raw) {
        await bot.sendMessage(chatId, "Нужно указать секцию. Пример:\n`/pm_show roadmap`", {
          parse_mode: "Markdown",
        });
        return;
      }

      const section = raw.split(" ")[0];

      try {
        const record = await getProjectSection(undefined, section);

        if (!record) {
          await bot.sendMessage(chatId, `В проектной памяти пока нет секции "${section}".`);
          return;
        }

        const maxLen = 3500;
        const textSnippet =
          record.content.length > maxLen
            ? record.content.slice(0, maxLen) + "\n\n...(обрезано, текст слишком длинный)..."
            : record.content;

        const msg =
          `🧠 Project Memory: ${record.section}\n` +
          `ID: ${record.id}\n` +
          `Обновлено: ${record.updated_at}\n\n` +
          textSnippet;

        await bot.sendMessage(chatId, msg);
      } catch (e) {
        console.error("❌ /pm_show error:", e);
        await bot.sendMessage(chatId, "Не удалось прочитать проектную память. См. логи сервера.");
      }

      return;
    }

    case "/mode": {
      const arg = commandArgs.toLowerCase();
      const valid = ["short", "normal", "long"];

      if (!valid.includes(arg)) {
        await bot.sendMessage(
          chatId,
          "Режимы ответа:\n" +
            "- short  — очень кратко (до 1–2 предложений)\n" +
            "- normal — средне, 3–7 предложений\n" +
            "- long   — развернуто, с пунктами и объяснениями\n\n" +
            "Текущий режим меняется командой `/mode <short|normal|long>`.\n\n" +
            "Команды:\n" +
            "/profile — профиль пользователя\n" +
            "/demo_task — создать демо-задачу\n" +
            "/btc_test_task — тестовый мониторинг BTC (mock)\n" +
            "/newtask <описание> — создать задачу\n" +
            "/run <id>\n" +
            "/tasks\n" +
            "/task <list|new|pause|resume|delete|id>\n" +
            "/stop_all_tasks\n" +
            "/meminfo\n" +
            "/memstats\n" +
            "/sources\n" +
            "/sources_diag\n" +
            "/source <key>\n" +
            "/diag_source <key>\n" +
            "/test_source <key>\n" +
            "/pm_set <section> <text>\n" +
            "/pm_show <section>\n" +
            "/mode <short|normal|long>"
        );
        return;
      }

      setAnswerMode(chatIdStr, arg);

      let desc = "";
      if (arg === "short") {
        desc =
          "короткие ответы (1–2 предложения, без лишних деталей, с приоритетом экономии токенов).";
      } else if (arg === "normal") {
        desc =
          "средние ответы (3–7 предложений, немного деталей, умеренная экономия токенов).";
      } else if (arg === "long") {
        desc =
          "развернутые ответы с пунктами и объяснениями (больше токенов, максимум пользы).";
      }

      await bot.sendMessage(chatId, `✅ Режим ответа установлен: ${arg}.\n\nОписание: ${desc}`);
      return;
    }

    default:
      return;
  }
}