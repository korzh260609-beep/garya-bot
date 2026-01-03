// src/users/accessRequests.js
// ============================================================================
// === 7.x — ACCESS REQUESTS (guest/citizen -> monarch approval queue) ========
// ============================================================================

import pool from "../../db.js";

/**
 * Таблица заявок на доступ:
 * - создаётся автоматически при старте (через ensureAccessRequestsTable)
 * - статус: pending | approved | denied
 * - meta JSONB: можно расширять без миграций
 */
export async function ensureAccessRequestsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS access_requests (
      id BIGSERIAL PRIMARY KEY,

      requester_chat_id TEXT NOT NULL,
      requester_name TEXT,
      requester_role TEXT,

      requested_action TEXT NOT NULL,   -- например: "cmd.task.create"
      requested_cmd TEXT,              -- например: "/newtask"

      status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | denied

      decided_by_chat_id TEXT,
      decision_note TEXT,

      meta JSONB NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_access_requests_status_created
    ON access_requests (status, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_access_requests_requester_action_status
    ON access_requests (requester_chat_id, requested_action, status);
  `);
}

/**
 * Анти-дубль: если уже есть pending-заявка от этого пользователя на этот action,
 * то не плодим новую (возвращаем существующую).
 */
export async function findPendingRequest({ requesterChatId, requestedAction }) {
  const res = await pool.query(
    `
    SELECT *
    FROM access_requests
    WHERE requester_chat_id = $1
      AND requested_action = $2
      AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [String(requesterChatId), String(requestedAction)]
  );

  return res.rows?.[0] || null;
}

export async function createAccessRequest({
  requesterChatId,
  requesterName = null,
  requesterRole = "guest",
  requestedAction,
  requestedCmd = null,
  meta = {},
}) {
  // 1) dedupe
  const existing = await findPendingRequest({
    requesterChatId,
    requestedAction,
  });
  if (existing) return existing;

  // 2) create
  const res = await pool.query(
    `
    INSERT INTO access_requests (
      requester_chat_id, requester_name, requester_role,
      requested_action, requested_cmd,
      status, meta
    )
    VALUES ($1, $2, $3, $4, $5, 'pending', $6)
    RETURNING *
    `,
    [
      String(requesterChatId),
      requesterName,
      String(requesterRole || "guest"),
      String(requestedAction),
      requestedCmd ? String(requestedCmd) : null,
      meta || {},
    ]
  );

  return res.rows?.[0] || null;
}

export function buildGuestDeniedText({ requestId }) {
  const id = requestId ? `#${requestId}` : "";
  return (
    `⛔ Недостаточно прав.\n` +
    `Я отправил запрос монарху на разрешение ${id}.\n` +
    `Ответ придёт после одобрения монарха.`
  );
}

export function buildMonarchRequestText(reqRow) {
  const id = reqRow?.id ? `#${reqRow.id}` : "#?";
  const who =
    reqRow?.requester_name
      ? `${reqRow.requester_name} (${reqRow.requester_chat_id})`
      : `${reqRow?.requester_chat_id || "?"}`;

  const role = reqRow?.requester_role || "guest";
  const cmd = reqRow?.requested_cmd || "-";
  const action = reqRow?.requested_action || "-";

  return (
    `🛡️ Запрос доступа ${id}\n\n` +
    `От: ${who}\n` +
    `Роль: ${role}\n` +
    `Команда: ${cmd}\n` +
    `Action: ${action}\n\n` +
    `Если хочешь выдать доступ: (следующим шагом добавим команду /grant или ручную выдачу через роль/permissions).`
  );
}

export async function notifyMonarch(bot, monarchChatId, reqRow) {
  if (!bot) return;
  if (!monarchChatId) return;

  const text = buildMonarchRequestText(reqRow);

  try {
    await bot.sendMessage(Number(monarchChatId), text.slice(0, 3800));
  } catch (err) {
    console.error("❌ notifyMonarch error:", err);
  }
}

/**
 * Удобная обёртка: создать заявку + уведомить монарха + вернуть тексты.
 * Это то, что будем вызывать вместо простого "⛔ Недостаточно прав."
 */
export async function createAccessRequestAndNotify({
  bot,
  monarchChatId,
  requesterChatId,
  requesterName,
  requesterRole,
  requestedAction,
  requestedCmd,
  meta = {},
}) {
  const reqRow = await createAccessRequest({
    requesterChatId,
    requesterName,
    requesterRole,
    requestedAction,
    requestedCmd,
    meta,
  });

  if (reqRow) {
    await notifyMonarch(bot, monarchChatId, reqRow);
  }

  return {
    request: reqRow,
    guestText: buildGuestDeniedText({ requestId: reqRow?.id }),
    monarchText: reqRow ? buildMonarchRequestText(reqRow) : null,
  };
}

// ============================================================================
// ✅ ADDED: approve/deny helpers for 7.11 V1
// ============================================================================

export async function getAccessRequestById(requestId) {
  const res = await pool.query(
    `
    SELECT *
    FROM access_requests
    WHERE id = $1
    LIMIT 1
    `,
    [Number(requestId)]
  );
  return res.rows?.[0] || null;
}

/**
 * Approve: pending -> approved
 * ВАЖНО: это НЕ выдаёт реальные GRANTS (7.12), а лишь закрывает очередь заявок (7.11).
 */
export async function approveAccessRequest({
  requestId,
  resolvedBy,
  note = null,
}) {
  const id = Number(requestId);
  if (!id) return { ok: false, error: "invalid_request_id" };

  // обновляем только pending (чтобы не перезатирать решение)
  const res = await pool.query(
    `
    UPDATE access_requests
    SET status = 'approved',
        decided_by_chat_id = $2,
        decision_note = $3,
        updated_at = NOW()
    WHERE id = $1
      AND status = 'pending'
    RETURNING *
    `,
    [id, String(resolvedBy || ""), note]
  );

  if (!res.rows?.length) {
    // либо не найдено, либо уже решено
    const existing = await getAccessRequestById(id);
    if (!existing) return { ok: false, error: "not_found" };
    return {
      ok: false,
      error: "not_pending",
      request: existing,
    };
  }

  return { ok: true, request: res.rows[0] };
}

/**
 * Deny: pending -> denied
 * ВАЖНО: это НЕ выдаёт реальные GRANTS (7.12), а лишь закрывает очередь заявок (7.11).
 */
export async function denyAccessRequest({ requestId, resolvedBy, note = null }) {
  const id = Number(requestId);
  if (!id) return { ok: false, error: "invalid_request_id" };

  const res = await pool.query(
    `
    UPDATE access_requests
    SET status = 'denied',
        decided_by_chat_id = $2,
        decision_note = $3,
        updated_at = NOW()
    WHERE id = $1
      AND status = 'pending'
    RETURNING *
    `,
    [id, String(resolvedBy || ""), note]
  );

  if (!res.rows?.length) {
    const existing = await getAccessRequestById(id);
    if (!existing) return { ok: false, error: "not_found" };
    return {
      ok: false,
      error: "not_pending",
      request: existing,
    };
  }

  return { ok: true, request: res.rows[0] };
}

// === Router helpers (DB-only + notify) — extracted from messageRouter.js (no behavior changes) ===

export async function approveAndNotify({ bot, chatId, chatIdStr, requestId }) {
  const result = await approveAccessRequest({
    requestId,
    resolvedBy: chatIdStr,
  });

  if (!result?.ok) {
    return { ok: false, error: result?.error || "unknown" };
  }

  const req =
    result.request ||
    result.row ||
    result.data ||
    result.accessRequest ||
    null;

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
        `✅ Монарх одобрил вашу заявку #${requestId}.`
      );
    } catch {
      // ignore
    }
  }

  await bot.sendMessage(chatId, `✅ Заявка #${requestId} одобрена.`);
  return { ok: true };
}

export async function denyAndNotify({ bot, chatId, chatIdStr, requestId }) {
  const result = await denyAccessRequest({
    requestId,
    resolvedBy: chatIdStr,
  });

  if (!result?.ok) {
    return { ok: false, error: result?.error || "unknown" };
  }

  const req =
    result.request ||
    result.row ||
    result.data ||
    result.accessRequest ||
    null;

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
        `⛔ Монарх отклонил вашу заявку #${requestId}.`
      );
    } catch {
      // ignore
    }
  }

  await bot.sendMessage(chatId, `⛔ Заявка #${requestId} отклонена.`);
  return { ok: true };
}

export async function listAccessRequests(n = 10) {
  const limit = Math.max(1, Math.min(Number(n) || 10, 30));

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
    [limit]
  );

  return { ok: true, rows: res.rows || [], limit };
}
