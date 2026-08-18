import { createPostgresTelegramWorkspaceRegistry } from '../telegramWorkspace/postgresWorkspaceRegistry.js';
import { createTelegramWorkspaceDiscoveryIntegration } from '../telegramWorkspace/telegramWorkspaceDiscoveryIntegration.js';

function requiredUpdateId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 0) throw new TypeError('telegram update_id must be a non-negative safe integer');
  return id;
}

function updateType(update) {
  return ['message', 'edited_message', 'channel_post', 'edited_channel_post', 'callback_query', 'my_chat_member', 'chat_member', 'chat_join_request']
    .find((key) => update?.[key]) ?? 'unknown';
}

function messageFrom(update) {
  return update?.message ?? update?.edited_message ?? update?.channel_post ?? update?.edited_channel_post ?? null;
}

export function createPostgresTelegramUpdateStore(database) {
  if (!database || typeof database.query !== 'function') throw new TypeError('database.query is required');

  // TWM1.3 requires the transactional persistence contract provided by the real
  // PostgreSQL runtime database. Legacy/query-only test doubles remain supported
  // for existing Telegram transport tests, but they cannot claim workspace discovery.
  const workspaceRegistry = typeof database.transaction === 'function'
    ? createPostgresTelegramWorkspaceRegistry(database)
    : null;
  const workspaceDiscovery = workspaceRegistry
    ? createTelegramWorkspaceDiscoveryIntegration({ registry: workspaceRegistry })
    : null;

  async function claim(update) {
    const updateId = requiredUpdateId(update?.update_id);

    // TWM1.3 discovery runs before the invocation filter and before the durable update claim.
    // Registry writes are idempotent, so duplicate/replayed Telegram updates repair state
    // without creating duplicate canonical workspace roots.
    if (workspaceDiscovery) await workspaceDiscovery.ingest(update);

    const message = messageFrom(update);
    const membershipChat = update?.my_chat_member?.chat ?? update?.chat_member?.chat ?? update?.chat_join_request?.chat ?? null;
    const membershipUser = update?.my_chat_member?.from ?? update?.chat_member?.from ?? update?.chat_join_request?.from ?? null;
    const result = await database.query(`
      INSERT INTO telegram_updates(update_id, update_type, chat_id, user_id, message_id, status)
      VALUES ($1, $2, $3, $4, $5, 'processing')
      ON CONFLICT (update_id) DO NOTHING
      RETURNING update_id
    `, [
      updateId,
      updateType(update),
      message?.chat?.id == null ? (membershipChat?.id == null ? null : String(membershipChat.id)) : String(message.chat.id),
      message?.from?.id == null ? (membershipUser?.id == null ? null : String(membershipUser.id)) : String(message.from.id),
      message?.message_id == null ? null : String(message.message_id)
    ]);
    return Object.freeze({ claimed: result.rowCount === 1, updateId });
  }

  async function complete(updateId, status = 'completed') {
    if (!['completed', 'ignored'].includes(status)) throw new TypeError('invalid Telegram completion status');
    await database.query(`
      UPDATE telegram_updates
      SET status = $2, completed_at = now(), failure_code = NULL
      WHERE update_id = $1
    `, [requiredUpdateId(updateId), status]);
  }

  async function fail(updateId, failureCode = 'telegram-update-failed') {
    await database.query(`
      UPDATE telegram_updates
      SET status = 'failed', completed_at = now(), failure_code = $2
      WHERE update_id = $1
    `, [requiredUpdateId(updateId), String(failureCode).slice(0, 120)]);
  }

  return Object.freeze({ claim, complete, fail, workspaceRegistry, workspaceDiscovery });
}
