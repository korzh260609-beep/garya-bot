function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function iso(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be a valid date`);
  return date.toISOString();
}
function row(value) {
  if (!value) return null;
  return Object.freeze({
    workspaceId: value.workspace_id,
    telegramUserId: value.telegram_user_id,
    globalUserId: value.global_user_id,
    state: value.state,
    accessMode: value.access_mode,
    requestedAt: value.requested_at?.toISOString?.() ?? String(value.requested_at),
    approvedAt: value.approved_at?.toISOString?.() ?? value.approved_at ?? null,
    accessStartsAt: value.access_starts_at?.toISOString?.() ?? value.access_starts_at ?? null,
    accessEndsAt: value.access_ends_at?.toISOString?.() ?? value.access_ends_at ?? null,
    removedAt: value.removed_at?.toISOString?.() ?? value.removed_at ?? null,
    lastPaymentChargeId: value.last_payment_charge_id ?? null,
    metadata: Object.freeze(value.metadata ?? {}),
    version: Number(value.version),
    updatedAt: value.updated_at?.toISOString?.() ?? String(value.updated_at)
  });
}
function inviteRow(value) {
  if (!value) return null;
  return Object.freeze({
    workspaceId: value.workspace_id,
    inviteLink: value.invite_link,
    inviteName: value.invite_name,
    createsJoinRequest: value.creates_join_request === true,
    createdByGlobalUserId: value.created_by_global_user_id,
    createdByTelegramUserId: value.created_by_telegram_user_id,
    createdAt: value.created_at?.toISOString?.() ?? String(value.created_at),
    rotatedAt: value.rotated_at?.toISOString?.() ?? value.rotated_at ?? null,
    version: Number(value.version)
  });
}
export function createPostgresMembershipAccessStore(database) {
  if (typeof database?.query !== 'function') throw new TypeError('started PostgreSQL database is required');
  async function recordRequest({ workspaceId, telegramUserId, globalUserId, requestedAt, metadata = {} }) {
    const result = await database.query(`
      INSERT INTO telegram_workspace_membership_access(
        workspace_id,telegram_user_id,global_user_id,state,access_mode,requested_at,metadata
      ) VALUES($1,$2,$3,'requested','free',$4,$5::jsonb)
      ON CONFLICT(workspace_id,telegram_user_id) DO UPDATE SET
        global_user_id=EXCLUDED.global_user_id,state='requested',access_mode='free',
        requested_at=EXCLUDED.requested_at,approved_at=NULL,access_starts_at=NULL,
        access_ends_at=NULL,removed_at=NULL,metadata=EXCLUDED.metadata,
        version=telegram_workspace_membership_access.version+1,updated_at=now()
      RETURNING *
    `, [required(workspaceId,'workspaceId'),required(String(telegramUserId),'telegramUserId'),required(globalUserId,'globalUserId'),iso(requestedAt,'requestedAt'),JSON.stringify(metadata)]);
    return row(result.rows[0]);
  }
  async function activateFree({ workspaceId, telegramUserId, approvedAt }) {
    const result = await database.query(`
      UPDATE telegram_workspace_membership_access
      SET state='active',access_mode='free',approved_at=$3,access_starts_at=$3,
          access_ends_at=NULL,removed_at=NULL,version=version+1,updated_at=now()
      WHERE workspace_id=$1 AND telegram_user_id=$2 AND state='requested'
      RETURNING *
    `, [required(workspaceId,'workspaceId'),required(String(telegramUserId),'telegramUserId'),iso(approvedAt,'approvedAt')]);
    if (result.rowCount !== 1) throw Object.assign(new Error('membership request is not pending'), { code: 'membership-request-not-pending' });
    return row(result.rows[0]);
  }
  async function markDeclined({ workspaceId, telegramUserId, at, reason }) {
    const result = await database.query(`
      UPDATE telegram_workspace_membership_access
      SET state='declined',removed_at=$3,metadata=metadata || $4::jsonb,
          version=version+1,updated_at=now()
      WHERE workspace_id=$1 AND telegram_user_id=$2
      RETURNING *
    `, [required(workspaceId,'workspaceId'),required(String(telegramUserId),'telegramUserId'),iso(at,'at'),JSON.stringify({ declineReason: required(reason,'reason') })]);
    return row(result.rows[0]);
  }
  async function markRemoved({ workspaceId, telegramUserId, at, reason }) {
    const result = await database.query(`
      UPDATE telegram_workspace_membership_access
      SET state='removed',removed_at=$3,metadata=metadata || $4::jsonb,
          version=version+1,updated_at=now()
      WHERE workspace_id=$1 AND telegram_user_id=$2
      RETURNING *
    `, [required(workspaceId,'workspaceId'),required(String(telegramUserId),'telegramUserId'),iso(at,'at'),JSON.stringify({ removalReason: required(reason,'reason') })]);
    return row(result.rows[0]);
  }
  async function get({ workspaceId, telegramUserId }) {
    const result = await database.query('SELECT * FROM telegram_workspace_membership_access WHERE workspace_id=$1 AND telegram_user_id=$2', [required(workspaceId,'workspaceId'),required(String(telegramUserId),'telegramUserId')]);
    return row(result.rows[0]);
  }
  async function getInvite({ workspaceId }) {
    const result = await database.query('SELECT * FROM telegram_workspace_membership_invites WHERE workspace_id=$1', [required(workspaceId,'workspaceId')]);
    return inviteRow(result.rows[0]);
  }
  async function saveInvite({ workspaceId, inviteLink, inviteName, createdByGlobalUserId, createdByTelegramUserId, at }) {
    const result = await database.query(`
      INSERT INTO telegram_workspace_membership_invites(
        workspace_id,invite_link,invite_name,created_by_global_user_id,created_by_telegram_user_id,created_at
      ) VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(workspace_id) DO UPDATE SET
        invite_link=EXCLUDED.invite_link,invite_name=EXCLUDED.invite_name,
        created_by_global_user_id=EXCLUDED.created_by_global_user_id,
        created_by_telegram_user_id=EXCLUDED.created_by_telegram_user_id,
        rotated_at=EXCLUDED.created_at,version=telegram_workspace_membership_invites.version+1,updated_at=now()
      RETURNING *
    `, [required(workspaceId,'workspaceId'),required(inviteLink,'inviteLink'),required(inviteName,'inviteName'),required(createdByGlobalUserId,'createdByGlobalUserId'),required(String(createdByTelegramUserId),'createdByTelegramUserId'),iso(at,'at')]);
    return inviteRow(result.rows[0]);
  }
  return Object.freeze({ recordRequest, activateFree, markDeclined, markRemoved, get, getInvite, saveInvite });
}
