// src/services/chatMemory/buildGroupSourceRecallStubResponse.js
// STAGE 8A.8 / 8A.9 — GROUP SOURCE RECALL STUB RESPONSE ASSEMBLER
//
// IMPORTANT:
// - stub only
// - NO DB reads
// - NO source fetching
// - NO real candidate selection
// - NO cross-group retrieval
// - NO author identity output
// - NO quotes
// - NO raw snippets
//
// Purpose:
// assemble one safe runtime payload for /recall --groups while the feature
// is still not enabled. This removes glue from recall.js and creates one
// explicit boundary for future transition from stub -> real runtime.
//
// Current behavior:
// - consumes already-safe stub/helper outputs
// - returns a normalized text block + meta
// - may optionally show already-rendered SAFE preview cards
// - never exposes any cross-group raw content
//
// Expected inputs:
// {
//   days,
//   limit,
//   keyword,
//   candidateResult,
//   previewResult,
//   renderedResult
// }

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

function safeText(value, max = 120) {
  const text = toSafeString(value).trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function safeCount(value, fallback = "0") {
  if (value == null) return fallback;
  return safeText(String(value), 20) || fallback;
}

function normalizeKeyword(value) {
  return safeText(toSafeString(value).trim(), 80);
}

function normalizeReason(input = {}) {
  const raw =
    safeText(input?.previewResult?.meta?.reason, 80) ||
    safeText(input?.candidateResult?.meta?.reason, 80) ||
    "not_enabled_yet";

  if (raw === "candidate_aware_preview_only") {
    return "preview_only";
  }

  if (raw === "chat_meta_only_candidates") {
    return "meta_only";
  }

  return raw;
}

function normalizeRenderedCards(input = {}) {
  return safeCount(input?.renderedResult?.meta?.inputStats?.renderedCards, "0");
}

function normalizePreviewCards(input = {}) {
  return safeCount(input?.previewResult?.meta?.counters?.cardsReturned, "0");
}

function normalizePreviewDecisions(input = {}) {
  return safeCount(input?.previewResult?.meta?.counters?.decisionsReturned, "0");
}

function normalizeRowsScanned(input = {}) {
  return safeCount(input?.candidateResult?.meta?.counters?.rowsScanned, "0");
}

function normalizeExcludedAliasMissing(input = {}) {
  return safeCount(
    input?.candidateResult?.meta?.counters?.excludedAliasMissing,
    "0"
  );
}

function normalizeExcludedRequesterChat(input = {}) {
  return safeCount(
    input?.candidateResult?.meta?.counters?.excludedRequesterChat,
    "0"
  );
}

function normalizeFilterDaysApplied(input = {}) {
  return safeCount(input?.candidateResult?.meta?.filters?.daysApplied, "0");
}

function normalizeFilterKeywordApplied(input = {}) {
  return safeText(
    input?.candidateResult?.meta?.filters?.keywordApplied,
    80
  );
}

function normalizeTopicSchemaPresent(input = {}) {
  const optional = input?.candidateResult?.meta?.optionalColumns;
  if (!optional || typeof optional !== "object") return "false";

  const present =
    optional.safe_topic === true ||
    optional.topic === true ||
    optional.meta === true ||
    optional.metadata === true;

  return present ? "true" : "false";
}

function normalizeSafeTopicColumn(input = {}) {
  return input?.candidateResult?.meta?.optionalColumns?.safe_topic === true
    ? "true"
    : "false";
}

function normalizeTopicColumn(input = {}) {
  return input?.candidateResult?.meta?.optionalColumns?.topic === true
    ? "true"
    : "false";
}

function normalizeMetaColumn(input = {}) {
  return input?.candidateResult?.meta?.optionalColumns?.meta === true
    ? "true"
    : "false";
}

function normalizeMetadataColumn(input = {}) {
  return input?.candidateResult?.meta?.optionalColumns?.metadata === true
    ? "true"
    : "false";
}

function normalizeCandidatesWithSafeTopic(input = {}) {
  return safeCount(
    input?.candidateResult?.meta?.counters?.candidatesWithSafeTopic,
    "0"
  );
}

function buildTopicFallbackReason(input = {}) {
  const optional = input?.candidateResult?.meta?.optionalColumns;
  const safeTopicCount = Number(
    input?.candidateResult?.meta?.counters?.candidatesWithSafeTopic
  );

  const hasOptionalObject = optional && typeof optional === "object";

  if (!hasOptionalObject) {
    return "optional_columns_unknown";
  }

  const schemaPresent =
    optional.safe_topic === true ||
    optional.topic === true ||
    optional.meta === true ||
    optional.metadata === true;

  if (!schemaPresent) {
    return "chat_meta_has_no_topic_related_columns";
  }

  if (Number.isFinite(safeTopicCount) && safeTopicCount <= 0) {
    return "topic_columns_exist_but_no_safe_topic_found_in_candidates";
  }

  return "metadata_topic_available";
}

function extractRenderedCardBlock(input = {}) {
  const rawOriginal = toSafeString(input?.renderedResult?.text);
  const raw = rawOriginal.trim();

  if (!raw) {
    return {
      text: "",
      shown: false,
    };
  }

  const lines = raw
    .split("\n")
    .map((line) => line.trimEnd());

  let startIndex = 0;

  if (lines[0] === "RECALL GROUPS:") {
    startIndex = 1;
  }

  if (lines[startIndex] && /^cards=\d+$/i.test(lines[startIndex])) {
    startIndex += 1;
  }

  while (startIndex < lines.length && !lines[startIndex].trim()) {
    startIndex += 1;
  }

  const body = lines.slice(startIndex).join("\n").trim();

  return {
    text: body ? body.slice(0, 3000) : "",
    shown: Boolean(body),
  };
}

export function buildGroupSourceRecallStubResponse(input = {}) {
  const days = clampNumber(input.days, 1, 30, 1);
  const limit = clampNumber(input.limit, 1, 20, 5);
  const keyword = normalizeKeyword(input.keyword);

  const reason = normalizeReason(input);
  const cardsRendered = normalizeRenderedCards(input);
  const previewCards = normalizePreviewCards(input);
  const previewDecisions = normalizePreviewDecisions(input);

  const rowsScanned = normalizeRowsScanned(input);
  const excludedAliasMissing = normalizeExcludedAliasMissing(input);
  const excludedRequesterChat = normalizeExcludedRequesterChat(input);
  const filterDaysApplied = normalizeFilterDaysApplied(input);
  const filterKeywordApplied = normalizeFilterKeywordApplied(input);

  const topicSchemaPresent = normalizeTopicSchemaPresent(input);
  const safeTopicColumn = normalizeSafeTopicColumn(input);
  const topicColumn = normalizeTopicColumn(input);
  const metaColumn = normalizeMetaColumn(input);
  const metadataColumn = normalizeMetadataColumn(input);
  const candidatesWithSafeTopic = normalizeCandidatesWithSafeTopic(input);
  const topicFallbackReason = buildTopicFallbackReason(input);

  const renderedPreview = extractRenderedCardBlock(input);

  const lines = [
    `RECALL GROUPS: ${reason}`,
    `days=${days}`,
    `limit=${limit}`,
    keyword ? `keyword=${keyword}` : "",
    `cards=${cardsRendered}`,
    `decisions=${previewDecisions}`,
    `preview=${renderedPreview.shown ? "true" : "false"}`,
    "",
    "SAFE FILTERS:",
    `filter_days_applied=${filterDaysApplied}`,
    `filter_keyword_applied=${filterKeywordApplied || "—"}`,
    `rows_scanned=${rowsScanned}`,
    `excluded_alias_missing=${excludedAliasMissing}`,
    `excluded_requester_chat=${excludedRequesterChat}`,
    "",
    "SAFE TOPIC DIAG:",
    `topic_schema_present=${topicSchemaPresent}`,
    `safe_topic_column=${safeTopicColumn}`,
    `topic_column=${topicColumn}`,
    `meta_column=${metaColumn}`,
    `metadata_column=${metadataColumn}`,
    `candidates_with_safe_topic=${candidatesWithSafeTopic}`,
    `topic_fallback_reason=${topicFallbackReason}`,
    "",
    "Cross-group retrieval is not enabled yet.",
    "Safe preview only.",
  ].filter(Boolean);

  if (renderedPreview.shown) {
    lines.push("");
    lines.push("SAFE PREVIEW CARDS:");
    lines.push(renderedPreview.text);
  }

  const text = lines.join("\n");

  return {
    ok: true,
    text,
    meta: {
      contractVersion: 9,
      stubOnly: true,
      runtimeActive: false,
      retrievalImplemented: false,
      dbReadsPerformed: false,
      sourceFetchingImplemented: false,
      safeOutputOnly: true,

      counters: {
        cardsRendered: Number(cardsRendered) || 0,
        previewCards: Number(previewCards) || 0,
        previewDecisions: Number(previewDecisions) || 0,
        rowsScanned: Number(rowsScanned) || 0,
        excludedAliasMissing: Number(excludedAliasMissing) || 0,
        excludedRequesterChat: Number(excludedRequesterChat) || 0,
        candidatesWithSafeTopic: Number(candidatesWithSafeTopic) || 0,
      },

      filters: {
        daysApplied: Number(filterDaysApplied) || 0,
        keywordApplied: filterKeywordApplied || "",
      },

      request: {
        scope: "include_groups",
        days,
        limit,
        keyword,
      },

      constraints: {
        noAuthorIdentity: true,
        noQuotes: true,
        noRawSnippets: true,
      },

      topicDiag: {
        topicSchemaPresent: topicSchemaPresent === "true",
        safeTopicColumn: safeTopicColumn === "true",
        topicColumn: topicColumn === "true",
        metaColumn: metaColumn === "true",
        metadataColumn: metadataColumn === "true",
        candidatesWithSafeTopic: Number(candidatesWithSafeTopic) || 0,
        topicFallbackReason,
      },

      preview: {
        safePreviewCardsShown: renderedPreview.shown,
        safePreviewTextLength: renderedPreview.text.length,
      },

      reason,
      totalLength: text.length,
    },
  };
}

export default buildGroupSourceRecallStubResponse;
