const DEFAULT_TTL_MS = 10 * 60 * 1000;

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function validMedia(media) {
  if (!media || typeof media !== 'object' || Array.isArray(media)) throw new TypeError('media is required');
  const mediaType = required(media.mediaType, 'media.mediaType');
  if (!['photo', 'video', 'document'].includes(mediaType)) throw new TypeError('unsupported media type');
  const fileId = required(media.fileId, 'media.fileId');
  return Object.freeze({
    mediaType,
    fileId,
    fileUniqueId: media.fileUniqueId == null ? null : String(media.fileUniqueId),
    fileName: media.fileName == null ? null : String(media.fileName),
    mimeType: media.mimeType == null ? null : String(media.mimeType),
    caption: media.caption == null ? '' : String(media.caption),
    updateId: media.updateId == null ? null : Number(media.updateId)
  });
}

function rowMedia(row) {
  if (!row) return null;
  const payload = row.media ?? {};
  return Object.freeze({
    ...validMedia(payload),
    capturedAt: row.captured_at instanceof Date ? row.captured_at.toISOString() : String(row.captured_at),
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at)
  });
}

export function createPostgresTelegramRecentMediaContextStore(database, { ttlMs = DEFAULT_TTL_MS, clock = () => new Date() } = {}) {
  if (typeof database?.query !== 'function') throw new TypeError('started PostgreSQL database is required');
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new TypeError('ttlMs must be a positive safe integer');
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');

  async function put({ actorGlobalUserId, chatId, media } = {}) {
    const actor = required(actorGlobalUserId, 'actorGlobalUserId');
    const chat = required(String(chatId), 'chatId');
    const payload = validMedia(media);
    const capturedAt = clock();
    if (!(capturedAt instanceof Date) || Number.isNaN(capturedAt.getTime())) throw new TypeError('clock must return a valid Date');
    const expiresAt = new Date(capturedAt.getTime() + ttlMs);
    const result = await database.query(
      `INSERT INTO telegram_recent_media_context(actor_global_user_id, telegram_chat_id, media, captured_at, expires_at)
       VALUES($1,$2,$3::jsonb,$4,$5)
       ON CONFLICT(actor_global_user_id, telegram_chat_id)
       DO UPDATE SET media=EXCLUDED.media, captured_at=EXCLUDED.captured_at, expires_at=EXCLUDED.expires_at
       RETURNING media,captured_at,expires_at`,
      [actor, chat, JSON.stringify(payload), capturedAt.toISOString(), expiresAt.toISOString()]
    );
    return rowMedia(result.rows[0]);
  }

  async function getLatest({ actorGlobalUserId, chatId } = {}) {
    const actor = required(actorGlobalUserId, 'actorGlobalUserId');
    const chat = required(String(chatId), 'chatId');
    const now = clock();
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError('clock must return a valid Date');
    const result = await database.query(
      `SELECT media,captured_at,expires_at
         FROM telegram_recent_media_context
        WHERE actor_global_user_id=$1 AND telegram_chat_id=$2 AND expires_at>$3
        LIMIT 1`,
      [actor, chat, now.toISOString()]
    );
    return rowMedia(result.rows[0]);
  }

  async function clearExpired() {
    const now = clock();
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError('clock must return a valid Date');
    const result = await database.query('DELETE FROM telegram_recent_media_context WHERE expires_at <= $1', [now.toISOString()]);
    return Number(result.rowCount ?? 0);
  }

  return Object.freeze({ put, getLatest, clearExpired, ttlMs });
}

export const TELEGRAM_RECENT_MEDIA_CONTEXT_DEFAULT_TTL_MS = DEFAULT_TTL_MS;
