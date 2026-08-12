import { randomUUID } from 'node:crypto';
import {
  TELEGRAM_WORKSPACE_CONFIG_NAMESPACES,
  TELEGRAM_WORKSPACE_ROLES,
  assertTelegramWorkspace,
  createTelegramWorkspace,
  telegramWorkspaceConfigNamespace
} from './workspaceContract.js';

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function workspaceId(value) {
  const id = required(value, 'workspaceId');
  if (!/^tgw_[A-Za-z0-9_-]{8,}$/.test(id)) {
    const error = new Error('workspaceId must be canonical');
    error.code = 'twm-workspace-scope-invalid';
    throw error;
  }
  return id;
}

function namespace(value) {
  const name = required(value, 'namespace');
  telegramWorkspaceConfigNamespace(name);
  return name;
}

function json(value) {
  return JSON.stringify(value ?? {});
}

function iso(value) {
  return value == null ? null : new Date(value).toISOString();
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) freeze(nested);
  return Object.freeze(value);
}

const SECRET_KEY = /(^|[_-])(api[_-]?key|token|secret|password|passwd|credential|authorization|cookie|private[_-]?key|access[_-]?key|client[_-]?secret)($|[_-])/i;

export function assertWorkspaceConfigContainsNoSecrets(value, path = 'config') {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertWorkspaceConfigContainsNoSecrets(item, `${path}[${index}]`));
    return value;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) {
      const error = new Error(`secret-shaped workspace config field rejected: ${path}.${key}`);
      error.code = 'twm-workspace-config-secret-field-rejected';
      throw error;
    }
    assertWorkspaceConfigContainsNoSecrets(nested, `${path}.${key}`);
  }
  return value;
}

function fromWorkspaceRow(row) {
  if (!row) return null;
  return createTelegramWorkspace({
    workspaceId: row.workspace_id,
    platform: row.platform,
    telegramChatId: row.telegram_chat_id,
    workspaceType: row.workspace_type,
    title: row.title,
    username: row.username,
    lifecycleState: row.lifecycle_state,
    botMembershipState: row.bot_membership_state,
    migration: row.migration,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  }, { clock: () => new Date(row.created_at) });
}

function fromConfigRow(row) {
  if (!row) return null;
  return freeze({
    workspaceId: row.workspace_id,
    namespace: row.namespace,
    config: row.config ?? {},
    version: Number(row.version),
    updatedByGlobalUserId: row.updated_by_global_user_id,
    traceId: row.trace_id,
    updatedAt: iso(row.updated_at)
  });
}

function scopeError(message = 'telegram workspace scope mismatch') {
  const error = new Error(message);
  error.code = 'twm-cross-workspace-denied';
  return error;
}

export function createPostgresTelegramWorkspaceStore(database) {
  if (!database?.query || !database?.transaction) throw new TypeError('started PostgreSQL database is required');

  async function ensureWorkspace(id, db = database) {
    const canonical = workspaceId(id);
    const result = await db.query('SELECT workspace_id FROM telegram_workspaces WHERE workspace_id=$1', [canonical]);
    if (result.rowCount !== 1) throw scopeError('telegram workspace not found in requested scope');
    return canonical;
  }

  async function putWorkspace(input, db = database) {
    const workspace = createTelegramWorkspace(input);
    assertTelegramWorkspace(workspace);
    const result = await db.query(`INSERT INTO telegram_workspaces(
      workspace_id,platform,telegram_chat_id,workspace_type,title,username,lifecycle_state,bot_membership_state,migration,created_at,updated_at)
      VALUES ($1,'telegram',$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
      ON CONFLICT(workspace_id) DO UPDATE SET
        telegram_chat_id=EXCLUDED.telegram_chat_id,
        workspace_type=EXCLUDED.workspace_type,
        title=EXCLUDED.title,
        username=EXCLUDED.username,
        lifecycle_state=EXCLUDED.lifecycle_state,
        bot_membership_state=EXCLUDED.bot_membership_state,
        migration=EXCLUDED.migration,
        updated_at=EXCLUDED.updated_at
      WHERE telegram_workspaces.platform='telegram'
      RETURNING *`, [
      workspace.workspaceId,
      workspace.telegramChatId,
      workspace.workspaceType,
      workspace.title,
      workspace.username,
      workspace.lifecycleState,
      workspace.botMembershipState,
      workspace.migration == null ? null : json(workspace.migration),
      workspace.createdAt,
      workspace.updatedAt
    ]);
    if (result.rowCount !== 1) throw scopeError();
    return fromWorkspaceRow(result.rows[0]);
  }

  async function getWorkspace(id, db = database) {
    const result = await db.query('SELECT * FROM telegram_workspaces WHERE workspace_id=$1 AND platform=\'telegram\'', [workspaceId(id)]);
    return fromWorkspaceRow(result.rows[0]);
  }

  async function getWorkspaceByTelegramChatId(telegramChatId, db = database) {
    const chatId = required(String(telegramChatId), 'telegramChatId');
    if (!/^-?\d+$/.test(chatId)) throw new TypeError('telegramChatId must be integer-compatible');
    const result = await db.query("SELECT * FROM telegram_workspaces WHERE platform='telegram' AND telegram_chat_id=$1", [chatId]);
    return fromWorkspaceRow(result.rows[0]);
  }

  async function putMember({ workspaceId: id, globalUserId, role, status = 'active', grantedByGlobalUserId = null, source = 'sg' }, db = database) {
    const canonical = await ensureWorkspace(id, db);
    const user = required(globalUserId, 'globalUserId');
    const normalizedRole = required(role, 'role').toUpperCase();
    if (!TELEGRAM_WORKSPACE_ROLES.includes(normalizedRole)) throw new TypeError(`unsupported workspace role: ${normalizedRole}`);
    if (!['active', 'revoked'].includes(status)) throw new TypeError(`unsupported member status: ${status}`);
    const result = await db.query(`INSERT INTO telegram_workspace_members(workspace_id,global_user_id,role,status,granted_by_global_user_id,source)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT(workspace_id,global_user_id) DO UPDATE SET
        role=EXCLUDED.role,status=EXCLUDED.status,granted_by_global_user_id=EXCLUDED.granted_by_global_user_id,source=EXCLUDED.source,updated_at=now()
      RETURNING *`, [canonical, user, normalizedRole, status, grantedByGlobalUserId, required(source, 'source')]);
    return freeze(result.rows[0]);
  }

  async function getMember({ workspaceId: id, globalUserId }, db = database) {
    const result = await db.query('SELECT * FROM telegram_workspace_members WHERE workspace_id=$1 AND global_user_id=$2', [workspaceId(id), required(globalUserId, 'globalUserId')]);
    return result.rows[0] ? freeze(result.rows[0]) : null;
  }

  async function listMembers({ workspaceId: id, status = null }, db = database) {
    const canonical = workspaceId(id);
    const result = await db.query(`SELECT * FROM telegram_workspace_members
      WHERE workspace_id=$1 AND ($2::text IS NULL OR status=$2)
      ORDER BY created_at,global_user_id`, [canonical, status]);
    return freeze(result.rows.map((row) => freeze(row)));
  }

  async function putBotPermissions({ workspaceId: id, membershipState, permissions = {}, fetchedAt, expiresAt = null }, db = database) {
    const canonical = await ensureWorkspace(id, db);
    assertWorkspaceConfigContainsNoSecrets(permissions, 'permissions');
    const fetched = iso(fetchedAt ?? new Date());
    const expires = iso(expiresAt);
    const result = await db.query(`INSERT INTO telegram_workspace_bot_permissions(workspace_id,membership_state,permissions,fetched_at,expires_at,updated_at)
      VALUES ($1,$2,$3::jsonb,$4,$5,now())
      ON CONFLICT(workspace_id) DO UPDATE SET
        membership_state=EXCLUDED.membership_state,permissions=EXCLUDED.permissions,fetched_at=EXCLUDED.fetched_at,expires_at=EXCLUDED.expires_at,updated_at=now()
      RETURNING *`, [canonical, required(membershipState, 'membershipState'), json(permissions), fetched, expires]);
    return freeze(result.rows[0]);
  }

  async function getBotPermissions(id, db = database) {
    const result = await db.query('SELECT * FROM telegram_workspace_bot_permissions WHERE workspace_id=$1', [workspaceId(id)]);
    return result.rows[0] ? freeze(result.rows[0]) : null;
  }

  async function setConfig({ workspaceId: id, namespace: rawNamespace, config = {}, actorGlobalUserId, traceId, reason = null, expectedVersion = null }, db = database) {
    const canonical = workspaceId(id);
    const configNamespace = namespace(rawNamespace);
    assertWorkspaceConfigContainsNoSecrets(config);
    const actor = required(actorGlobalUserId, 'actorGlobalUserId');
    const trace = required(traceId, 'traceId');

    return db.transaction(async (tx) => {
      await ensureWorkspace(canonical, tx);
      const current = await tx.query(`SELECT * FROM telegram_workspace_configs
        WHERE workspace_id=$1 AND namespace=$2 FOR UPDATE`, [canonical, configNamespace]);
      const currentRow = current.rows[0] ?? null;
      const currentVersion = currentRow ? Number(currentRow.version) : 0;
      if (expectedVersion !== null && Number(expectedVersion) !== currentVersion) {
        const error = new Error(`workspace config version conflict: expected ${expectedVersion}, current ${currentVersion}`);
        error.code = 'twm-workspace-config-version-conflict';
        throw error;
      }
      const nextVersion = currentVersion + 1;
      const updated = await tx.query(`INSERT INTO telegram_workspace_configs(
        workspace_id,namespace,config,version,updated_by_global_user_id,trace_id,updated_at)
        VALUES ($1,$2,$3::jsonb,$4,$5,$6,now())
        ON CONFLICT(workspace_id,namespace) DO UPDATE SET
          config=EXCLUDED.config,version=EXCLUDED.version,updated_by_global_user_id=EXCLUDED.updated_by_global_user_id,trace_id=EXCLUDED.trace_id,updated_at=now()
        RETURNING *`, [canonical, configNamespace, json(config), nextVersion, actor, trace]);
      await tx.query(`INSERT INTO telegram_workspace_config_history(
        history_id,workspace_id,namespace,version,previous_config,new_config,actor_global_user_id,trace_id,reason)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)`, [
        randomUUID(), canonical, configNamespace, nextVersion,
        currentRow ? json(currentRow.config) : null,
        json(config), actor, trace, reason
      ]);
      return fromConfigRow(updated.rows[0]);
    });
  }

  async function getConfig({ workspaceId: id, namespace: rawNamespace }, db = database) {
    const result = await db.query('SELECT * FROM telegram_workspace_configs WHERE workspace_id=$1 AND namespace=$2', [workspaceId(id), namespace(rawNamespace)]);
    return fromConfigRow(result.rows[0]);
  }

  async function listConfigs({ workspaceId: id }, db = database) {
    const result = await db.query('SELECT * FROM telegram_workspace_configs WHERE workspace_id=$1 ORDER BY namespace', [workspaceId(id)]);
    return freeze(result.rows.map(fromConfigRow));
  }

  async function configHistory({ workspaceId: id, namespace: rawNamespace, limit = 100 }, db = database) {
    const bounded = Math.max(1, Math.min(Number(limit) || 100, 500));
    const result = await db.query(`SELECT * FROM telegram_workspace_config_history
      WHERE workspace_id=$1 AND namespace=$2 ORDER BY version DESC LIMIT $3`, [workspaceId(id), namespace(rawNamespace), bounded]);
    return freeze(result.rows.map((row) => freeze({ ...row, version: Number(row.version), created_at: iso(row.created_at) })));
  }

  return Object.freeze({
    putWorkspace,
    getWorkspace,
    getWorkspaceByTelegramChatId,
    putMember,
    getMember,
    listMembers,
    putBotPermissions,
    getBotPermissions,
    setConfig,
    getConfig,
    listConfigs,
    configHistory
  });
}

export const TELEGRAM_WORKSPACE_PERSISTED_CONFIG_NAMESPACES = TELEGRAM_WORKSPACE_CONFIG_NAMESPACES;
