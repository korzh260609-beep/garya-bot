import { randomUUID } from 'node:crypto';

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function normalize(row) {
  if (!row) return null;
  return freeze({
    token: row.token,
    workspaceId: row.workspace_id,
    actorGlobalUserId: row.actor_global_user_id,
    telegramUserId: row.telegram_user_id,
    requestId: row.request_id,
    traceId: row.trace_id,
    proposal: row.proposal,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null
  });
}

export function createPostgresTelegramWorkspaceNaturalLanguagePendingStore(database, { clock = () => new Date(), ttlMs = 10 * 60 * 1000 } = {}) {
  if (!database?.query || !database?.transaction) throw new TypeError('started PostgreSQL database is required');
  const ttl = Number(ttlMs);
  if (!Number.isFinite(ttl) || ttl < 30_000 || ttl > 60 * 60 * 1000) throw new TypeError('ttlMs must be between 30 seconds and 1 hour');

  async function create({ workspaceId, actorGlobalUserId, telegramUserId, requestId, traceId, proposal }) {
    const now = clock();
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError('clock must return a valid Date');
    const token = `twn_${randomUUID().replaceAll('-', '')}`;
    const expiresAt = new Date(now.getTime() + ttl);
    const result = await database.query(`INSERT INTO telegram_workspace_pending_actions(
      token,workspace_id,actor_global_user_id,telegram_user_id,request_id,trace_id,proposal,status,created_at,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'pending',$8,$9) RETURNING *`, [
      token,
      required(workspaceId, 'workspaceId'),
      required(actorGlobalUserId, 'actorGlobalUserId'),
      required(String(telegramUserId), 'telegramUserId'),
      required(requestId, 'requestId'),
      required(traceId, 'traceId'),
      JSON.stringify(proposal),
      now,
      expiresAt
    ]);
    return normalize(result.rows[0]);
  }

  async function claim({ token, actorGlobalUserId, telegramUserId }) {
    return database.transaction(async (tx) => {
      const now = clock();
      const result = await tx.query(`UPDATE telegram_workspace_pending_actions
        SET status='processing'
        WHERE token=$1 AND actor_global_user_id=$2 AND telegram_user_id=$3
          AND status='pending' AND expires_at>$4
        RETURNING *`, [required(token, 'token'), required(actorGlobalUserId, 'actorGlobalUserId'), required(String(telegramUserId), 'telegramUserId'), now]);
      if (result.rowCount === 1) return normalize(result.rows[0]);
      const existing = await tx.query('SELECT * FROM telegram_workspace_pending_actions WHERE token=$1', [token]);
      return normalize(existing.rows[0]);
    });
  }

  async function complete(token) {
    const result = await database.query(`UPDATE telegram_workspace_pending_actions SET status='completed',completed_at=now()
      WHERE token=$1 AND status='processing' RETURNING *`, [required(token, 'token')]);
    return normalize(result.rows[0]);
  }

  async function fail(token) {
    const result = await database.query(`UPDATE telegram_workspace_pending_actions SET status='failed',completed_at=now()
      WHERE token=$1 AND status='processing' RETURNING *`, [required(token, 'token')]);
    return normalize(result.rows[0]);
  }

  async function cancel({ token, actorGlobalUserId, telegramUserId }) {
    const result = await database.query(`UPDATE telegram_workspace_pending_actions SET status='cancelled',completed_at=now()
      WHERE token=$1 AND actor_global_user_id=$2 AND telegram_user_id=$3 AND status='pending' RETURNING *`, [
      required(token, 'token'), required(actorGlobalUserId, 'actorGlobalUserId'), required(String(telegramUserId), 'telegramUserId')
    ]);
    return normalize(result.rows[0]);
  }

  return Object.freeze({ create, claim, complete, fail, cancel });
}
