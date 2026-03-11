// src/services/chatMemory/getGroupSourceRecallCandidates.js
// STAGE 8A.8 — GROUP SOURCE RECALL CANDIDATES (CHAT_META-ONLY SELECTOR)
//
// IMPORTANT:
// - first real data step
// - reads ONLY from chat_meta
// - NO chat_messages reads
// - NO cross-group message retrieval
// - NO RecallEngine integration here
// - NO policy bypass
// - NO author identity output
// - NO quotes
// - NO raw snippets
// - NO message content
// - local /recall must remain unaffected
//
// Purpose:
// upgrade the runtime boundary from pure []-stub into a safe chat_meta-only selector,
// so /recall --groups can see eligible source groups metadata without exposing content.
//
// Allowed source fields:
// - platform
// - chat_id
// - chat_type
// - alias
// - privacy_level
// - source_enabled
// - allow_quotes
// - allow_raw_snippets
// - message_count
// - last_message_at
// - updated_at
//
// Hard safety in this step:
// - return metadata candidates only
// - rawText stays empty
// - no snippets, no quotes, no author data
// - exclude requester chat
// - only source_enabled = true
//
// SAFE TOPIC STEP:
// - does NOT assume schema blindly
// - first checks chat_meta columns through information_schema
// - uses safe_topic / topic / meta / metadata only if реально существуют
// - no runtime crash if such columns are absent

import pool from "../../../db.js";

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

function normalizeRole(role) {
  const value = toSafeString(role).trim().toLowerCase();

  if (!value) return "guest";
  if (value === "monarch") return "monarch";
  if (value === "vip") return "vip";
  if (value === "citizen") return "citizen";
  return "guest";
}

function normalizeChatId(value) {
  const text = toSafeString(value).trim();
  return text || null;
}

function normalizeKeyword(value) {
  return toSafeString(value).trim();
}

function normalizeTimestamp(value) {
  if (!value) return null;

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  return d.toISOString();
}

function buildSinceIso(days) {
  const safeDays = clampNumber(days, 1, 30, 1);
  const now = Date.now();
  const sinceMs = now - safeDays * 24 * 60 * 60 * 1000;
  return new Date(sinceMs).toISOString();
}

function normalizeBoolean(value) {
  return value === true;
}

function safeText(value, max = 80) {
  const text = toSafeString(value).trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function buildSafeRequestMeta(input = {}) {
  const role = normalizeRole(input.role);

  return {
    role,
    requesterChatId: normalizeChatId(input.requesterChatId),
    requesterGlobalUserId: normalizeChatId(input.requesterGlobalUserId),
    days: clampNumber(input.days, 1, 30, 1),
    limit: clampNumber(input.limit, 1, 50, 5),
    keyword: normalizeKeyword(input.keyword),
  };
}

function extractSafeTopicFromJson(value) {
  if (!value || typeof value !== "object") return "";

  const direct =
    toSafeString(value.safe_topic).trim() ||
    toSafeString(value.safeTopic).trim() ||
    toSafeString(value.topic).trim();

  return safeText(direct, 80);
}

function extractSafeTopic(row = {}) {
  const direct =
    toSafeString(row.safe_topic).trim() ||
    toSafeString(row.topic).trim();

  if (direct) {
    return safeText(direct, 80);
  }

  const fromMeta = extractSafeTopicFromJson(row.meta);
  if (fromMeta) return fromMeta;

  const fromMetadata = extractSafeTopicFromJson(row.metadata);
  if (fromMetadata) return fromMetadata;

  return "";
}

function normalizeCandidateRow(row = {}) {
  const safeTopic = extractSafeTopic(row);

  return {
    platform: toSafeString(row.platform || "telegram").trim() || "telegram",
    chatId: normalizeChatId(row.chat_id),
    chatType: toSafeString(row.chat_type).trim() || null,
    alias: toSafeString(row.alias).trim(),
    privacyLevel: toSafeString(row.privacy_level).trim() || "private",
    sourceEnabled: normalizeBoolean(row.source_enabled),

    // hard-safe in this step:
    // candidate metadata only, no content
    rawText: "",
    date: normalizeTimestamp(row.last_message_at || row.updated_at || null),
    confidence: 0.5,
    safeTopic,

    meta: {
      source: "chat_meta",
      selectorMode: "chat_meta_only",
      allowQuotes: normalizeBoolean(row.allow_quotes),
      allowRawSnippets: normalizeBoolean(row.allow_raw_snippets),
      messageCount:
        row.message_count == null
          ? null
          : clampNumber(row.message_count, 0, 1_000_000_000, 0),
      lastMessageAt: normalizeTimestamp(row.last_message_at),
      updatedAt: normalizeTimestamp(row.updated_at),
      safeTopic,
    },
  };
}

async function detectChatMetaOptionalColumns() {
  const sql = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_meta'
      AND column_name IN ('safe_topic', 'topic', 'meta', 'metadata')
  `;

  const result = await pool.query(sql);
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const set = new Set(rows.map((r) => String(r.column_name || "").trim()));

  return {
    hasSafeTopic: set.has("safe_topic"),
    hasTopic: set.has("topic"),
    hasMeta: set.has("meta"),
    hasMetadata: set.has("metadata"),
  };
}

function buildOptionalSelectSql(columns) {
  const parts = [];

  if (columns.hasSafeTopic) {
    parts.push(`safe_topic`);
  }

  if (columns.hasTopic) {
    parts.push(`topic`);
  }

  if (columns.hasMeta) {
    parts.push(`meta`);
  }

  if (columns.hasMetadata) {
    parts.push(`metadata`);
  }

  return parts.length ? `,\n        ${parts.join(",\n        ")}` : "";
}

export async function getGroupSourceRecallCandidates(input = {}) {
  const request = buildSafeRequestMeta(input);

  const meta = {
    contractVersion: 3,
    runtimeStub: false,
    runtimeActive: true,
    sourceSelectionImplemented: true,
    selectorMode: "chat_meta_only",
    dbReadsPerformed: false,
    dbSource: "chat_meta",
    policyBypassUsed: false,
    safeOutputOnly: true,
    retrievalImplemented: false,
    contentReadsPerformed: false,
    reason: "chat_meta_only_candidates",

    request,

    counters: {
      rowsScanned: 0,
      candidatesFound: 0,
      candidatesReturned: 0,
      excludedRequesterChat: 0,
      excludedAliasMissing: 0,
      candidatesWithSafeTopic: 0,
    },

    filters: {
      daysApplied: request.days,
      keywordApplied: request.keyword || "",
    },

    optionalColumns: {
      safe_topic: false,
      topic: false,
      meta: false,
      metadata: false,
    },

    constraints: {
      metadataOnly: true,
      noMessageContent: true,
      noAuthorIdentity: true,
      noQuotes: true,
      noRawSnippets: true,
      localRecallUnaffected: true,
      recallEngineUntouched: true,
    },
  };

  try {
    const sinceIso = buildSinceIso(request.days);
    const hasKeyword = Boolean(request.keyword);

    const detected = await detectChatMetaOptionalColumns();

    meta.optionalColumns.safe_topic = detected.hasSafeTopic;
    meta.optionalColumns.topic = detected.hasTopic;
    meta.optionalColumns.meta = detected.hasMeta;
    meta.optionalColumns.metadata = detected.hasMetadata;

    const optionalSelectSql = buildOptionalSelectSql(detected);

    const sql = `
      SELECT
        platform,
        chat_id,
        chat_type,
        alias,
        privacy_level,
        source_enabled,
        allow_quotes,
        allow_raw_snippets,
        message_count,
        last_message_at,
        updated_at${optionalSelectSql}
      FROM chat_meta
      WHERE source_enabled = true
        AND COALESCE(last_message_at, updated_at) >= $1
        AND ($2 = '' OR alias ILIKE $3)
      ORDER BY
        COALESCE(last_message_at, updated_at) DESC NULLS LAST,
        updated_at DESC NULLS LAST,
        chat_id ASC
      LIMIT $4
    `;

    // Fetch a small buffer above requested limit to allow safe exclusion
    // of requester chat and alias-missing rows without extra queries.
    const fetchLimit = Math.min(request.limit + 10, 100);
    const keywordLike = hasKeyword ? `%${request.keyword}%` : "%";

    const result = await pool.query(sql, [
      sinceIso,
      request.keyword,
      keywordLike,
      fetchLimit,
    ]);
    const rows = Array.isArray(result?.rows) ? result.rows : [];

    meta.dbReadsPerformed = true;
    meta.counters.rowsScanned = rows.length;

    const candidates = [];

    for (const row of rows) {
      if (candidates.length >= request.limit) break;

      const candidate = normalizeCandidateRow(row);

      if (!candidate.alias) {
        meta.counters.excludedAliasMissing += 1;
        continue;
      }

      if (request.requesterChatId && candidate.chatId === request.requesterChatId) {
        meta.counters.excludedRequesterChat += 1;
        continue;
      }

      if (candidate.safeTopic) {
        meta.counters.candidatesWithSafeTopic += 1;
      }

      candidates.push(candidate);
    }

    meta.counters.candidatesFound = candidates.length;
    meta.counters.candidatesReturned = candidates.length;

    return {
      ok: true,
      candidates,
      meta,
    };
  } catch (e) {
    return {
      ok: true,
      candidates: [],
      meta: {
        ...meta,
        dbReadsPerformed: true,
        sourceSelectionImplemented: false,
        runtimeActive: false,
        reason: "chat_meta_select_failed",
        error: toSafeString(e?.message).trim() || "unknown",
      },
    };
  }
}

export default getGroupSourceRecallCandidates;