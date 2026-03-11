import pool from "../../db.js";

function toSafeString(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return Math.trunc(n);
}

function normalizeChatId(value) {
  const text = toSafeString(value).trim();
  return text || null;
}

function normalizeTimestamp(value) {
  if (!value) return null;

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  return d.toISOString();
}

function safeBool(value) {
  return value === true;
}

function hasNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function extractTopicFromJson(value) {
  if (!value || typeof value !== "object") return "";

  const direct =
    toSafeString(value.safe_topic).trim() ||
    toSafeString(value.safeTopic).trim() ||
    toSafeString(value.topic).trim();

  return direct;
}

async function detectChatMetaOptionalTopicColumns() {
  const res = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_meta'
      AND column_name IN ('safe_topic', 'topic', 'meta', 'metadata')
    `
  );

  const rows = Array.isArray(res.rows) ? res.rows : [];
  const set = new Set(rows.map((r) => String(r.column_name || "").trim()));

  return {
    safe_topic: set.has("safe_topic"),
    topic: set.has("topic"),
    meta: set.has("meta"),
    metadata: set.has("metadata"),
  };
}

function buildOptionalTopicSelectSql(columns) {
  const parts = [];

  if (columns.safe_topic) parts.push("safe_topic");
  if (columns.topic) parts.push("topic");
  if (columns.meta) parts.push("meta");
  if (columns.metadata) parts.push("metadata");

  return parts.length ? `,\n      ${parts.join(",\n      ")}` : "";
}

function normalizeTopicDiagRow(row = {}, columns = {}) {
  const safeTopicPresent =
    columns.safe_topic && hasNonEmptyString(row.safe_topic);
  const topicPresent =
    columns.topic && hasNonEmptyString(row.topic);

  const metaTopicPresent =
    columns.meta && hasNonEmptyString(extractTopicFromJson(row.meta));

  const metadataTopicPresent =
    columns.metadata && hasNonEmptyString(extractTopicFromJson(row.metadata));

  return {
    platform: toSafeString(row.platform || "telegram").trim() || "telegram",
    chat_id: normalizeChatId(row.chat_id),
    chat_type: toSafeString(row.chat_type).trim() || null,
    alias: toSafeString(row.alias).trim() || "",
    source_enabled: safeBool(row.source_enabled),
    privacy_level: toSafeString(row.privacy_level).trim() || "private",
    last_message_at: normalizeTimestamp(row.last_message_at),
    updated_at: normalizeTimestamp(row.updated_at),

    topic_presence: {
      safe_topic: safeTopicPresent,
      topic: topicPresent,
      meta_topic: metaTopicPresent,
      metadata_topic: metadataTopicPresent,
      any:
        safeTopicPresent ||
        topicPresent ||
        metaTopicPresent ||
        metadataTopicPresent,
    },
  };
}

export async function upsertChatMeta({
  platform,
  chatId,
  chatType,
  title = null,
}) {
  const res = await pool.query(
    `
    INSERT INTO chat_meta (
      platform,
      chat_id,
      chat_type,
      title
    )
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (platform, chat_id)
    DO UPDATE SET
      chat_type = EXCLUDED.chat_type,
      title = COALESCE(EXCLUDED.title, chat_meta.title)
    RETURNING *
    `,
    [platform, chatId, chatType, title]
  );

  return res.rows[0];
}

export async function getChatMeta(platform, chatId) {
  const res = await pool.query(
    `
    SELECT *
    FROM chat_meta
    WHERE platform = $1
      AND chat_id = $2
    LIMIT 1
    `,
    [platform, chatId]
  );

  return res.rows[0] || null;
}

export async function updateChatSourceFlags({
  platform,
  chatId,
  sourceEnabled,
  privacyLevel,
  allowQuotes,
  allowRawSnippets,
}) {
  const res = await pool.query(
    `
    UPDATE chat_meta
    SET
      source_enabled = COALESCE($3, source_enabled),
      privacy_level = COALESCE($4, privacy_level),
      allow_quotes = COALESCE($5, allow_quotes),
      allow_raw_snippets = COALESCE($6, allow_raw_snippets)
    WHERE platform = $1
      AND chat_id = $2
    RETURNING *
    `,
    [
      platform,
      chatId,
      sourceEnabled ?? null,
      privacyLevel ?? null,
      allowQuotes ?? null,
      allowRawSnippets ?? null,
    ]
  );

  return res.rows[0] || null;
}

export async function updateChatMetaFields({
  platform,
  chatId,
  alias,
  privacyLevel,
}) {
  const res = await pool.query(
    `
    UPDATE chat_meta
    SET
      alias = COALESCE($3, alias),
      privacy_level = COALESCE($4, privacy_level)
    WHERE platform = $1
      AND chat_id = $2
    RETURNING *
    `,
    [
      platform,
      chatId,
      alias ?? null,
      privacyLevel ?? null,
    ]
  );

  return res.rows[0] || null;
}

export async function listKnownChats({
  platform = "telegram",
  limit = 20,
  includePrivate = false,
} = {}) {
  const safeLimit = Number.isFinite(Number(limit))
    ? Math.max(1, Math.min(100, Math.trunc(Number(limit))))
    : 20;

  const res = await pool.query(
    `
    SELECT
      platform,
      chat_id,
      chat_type,
      alias,
      source_enabled,
      privacy_level,
      allow_quotes,
      allow_raw_snippets,
      message_count,
      last_message_at,
      updated_at
    FROM chat_meta
    WHERE platform = $1
      AND ($2::boolean = true OR COALESCE(chat_type, '') <> 'private')
    ORDER BY
      COALESCE(last_message_at, updated_at) DESC NULLS LAST,
      updated_at DESC NULLS LAST,
      chat_id ASC
    LIMIT $3
    `,
    [platform, includePrivate, safeLimit]
  );

  return Array.isArray(res.rows) ? res.rows : [];
}

export async function getChatMetaTopicDiag({
  platform = "telegram",
  chatId = null,
  limit = 10,
} = {}) {
  const safePlatform = toSafeString(platform).trim() || "telegram";
  const safeChatId = normalizeChatId(chatId);
  const safeLimit = clampNumber(limit, 1, 50, 10);

  const optionalColumns = await detectChatMetaOptionalTopicColumns();
  const optionalSelectSql = buildOptionalTopicSelectSql(optionalColumns);

  const params = [safePlatform];
  let whereSql = `
    WHERE platform = $1
  `;

  if (safeChatId) {
    params.push(safeChatId);
    whereSql += `
      AND chat_id = $2
    `;
  }

  params.push(safeLimit);
  const limitParamIndex = params.length;

  const res = await pool.query(
    `
    SELECT
      platform,
      chat_id,
      chat_type,
      alias,
      source_enabled,
      privacy_level,
      last_message_at,
      updated_at${optionalSelectSql}
    FROM chat_meta
    ${whereSql}
    ORDER BY
      COALESCE(last_message_at, updated_at) DESC NULLS LAST,
      updated_at DESC NULLS LAST,
      chat_id ASC
    LIMIT $${limitParamIndex}
    `,
    params
  );

  const rawRows = Array.isArray(res.rows) ? res.rows : [];
  const rows = rawRows.map((row) => normalizeTopicDiagRow(row, optionalColumns));

  const stats = {
    rows_scanned: rows.length,
    rows_with_safe_topic: 0,
    rows_with_topic: 0,
    rows_with_meta_topic: 0,
    rows_with_metadata_topic: 0,
    rows_with_any_topic: 0,
  };

  for (const row of rows) {
    if (row.topic_presence.safe_topic) stats.rows_with_safe_topic += 1;
    if (row.topic_presence.topic) stats.rows_with_topic += 1;
    if (row.topic_presence.meta_topic) stats.rows_with_meta_topic += 1;
    if (row.topic_presence.metadata_topic) stats.rows_with_metadata_topic += 1;
    if (row.topic_presence.any) stats.rows_with_any_topic += 1;
  }

  return {
    ok: true,
    platform: safePlatform,
    chat_filter: safeChatId,
    limit: safeLimit,
    optional_columns: optionalColumns,
    stats,
    rows,
    meta: {
      read_only: true,
      source: "chat_meta_only",
      message_reads_performed: false,
      cross_group_retrieval_enabled: false,
      safe_output_only: true,
      no_author_identity: true,
      no_quotes: true,
      no_raw_snippets: true,
    },
  };
}