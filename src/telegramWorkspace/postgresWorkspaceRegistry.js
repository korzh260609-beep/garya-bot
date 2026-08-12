import { createPostgresTelegramWorkspaceStore } from './postgresWorkspaceStore.js';
import { createTelegramWorkspaceRegistry } from './telegramWorkspaceRegistry.js';

function normalizeRow(row) {
  return Object.freeze({
    workspaceId: row.workspace_id,
    platform: row.platform,
    telegramChatId: row.telegram_chat_id,
    workspaceType: row.workspace_type,
    title: row.title,
    username: row.username,
    lifecycleState: row.lifecycle_state,
    botMembershipState: row.bot_membership_state,
    migration: row.migration,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  });
}

export function createPostgresTelegramWorkspaceRegistry(database, options = {}) {
  if (!database?.query || !database?.transaction) throw new TypeError('started PostgreSQL database is required');
  const store = createPostgresTelegramWorkspaceStore(database);
  const registry = createTelegramWorkspaceRegistry({ store, ...options });

  async function listWorkspaces({ lifecycleState = null, workspaceType = null, limit = 100 } = {}) {
    const bounded = Math.max(1, Math.min(Number(limit) || 100, 500));
    const result = await database.query(`SELECT * FROM telegram_workspaces
      WHERE platform='telegram'
        AND ($1::text IS NULL OR lifecycle_state=$1)
        AND ($2::text IS NULL OR workspace_type=$2)
      ORDER BY updated_at DESC, workspace_id
      LIMIT $3`, [lifecycleState, workspaceType, bounded]);
    return Object.freeze(result.rows.map(normalizeRow));
  }

  return Object.freeze({
    ...registry,
    listWorkspaces,
    store
  });
}
