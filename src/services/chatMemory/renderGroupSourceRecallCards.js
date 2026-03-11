// src/services/chatMemory/renderGroupSourceRecallCards.js
// STAGE 8A.9 — GROUP SOURCE RECALL CARD RENDERER (SAFE FORMATTER ONLY)
//
// IMPORTANT:
// - formatter only
// - NO DB reads
// - NO source fetching
// - NO cross-group retrieval
// - NO RecallEngine integration here
// - NO author identity output
// - NO quotes
// - NO raw snippets
//
// Purpose:
// convert already-built anonymous group-source recall cards into one safe text block
// for future command/runtime usage, without changing current behavior.
//
// Expected future input card shape:
// {
//   group_alias: string,
//   date: string|null,
//   topic: string,
//   summary: string,
//   confidence: number
// }
//
// Current step boundary:
// - input is trusted only as anon-card-like structure
// - renderer still re-sanitizes values defensively
// - renderer remains safe even if some caller passes malformed cards

const DEFAULT_MAX_CARDS = 10;
const DEFAULT_MAX_TOPIC_LEN = 120;
const DEFAULT_MAX_SUMMARY_LEN = 300;
const DEFAULT_MAX_ALIAS_LEN = 80;
const DEFAULT_MAX_TOTAL_LEN = 3500;

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

function normalizeWhitespace(text = "") {
  return toSafeString(text)
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collapseToSingleLine(text = "") {
  return normalizeWhitespace(text).replace(/\n+/g, " ").trim();
}

function safeTruncate(text = "", maxLen = 200) {
  const source = toSafeString(text).trim();
  const limit = clampNumber(maxLen, 1, 5000, 200);

  if (source.length <= limit) {
    return {
      text: source,
      truncated: false,
      originalLength: source.length,
      finalLength: source.length,
    };
  }

  const sliced = source.slice(0, limit).trimEnd();

  return {
    text: `${sliced}…`,
    truncated: true,
    originalLength: source.length,
    finalLength: sliced.length + 1,
  };
}

function normalizeConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function formatConfidence(value) {
  const normalized = normalizeConfidence(value);
  return normalized.toFixed(2);
}

function normalizeIsoDate(value) {
  if (!value) return null;

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  return d.toISOString();
}

function formatDateShort(iso) {
  const normalized = normalizeIsoDate(iso);
  if (!normalized) return "—";
  return normalized.slice(0, 10);
}

function sanitizeAlias(value, maxLen = DEFAULT_MAX_ALIAS_LEN) {
  const oneLine = collapseToSingleLine(value);
  const trunc = safeTruncate(oneLine || "—", maxLen);
  return {
    value: trunc.text || "—",
    truncated: trunc.truncated,
  };
}

function sanitizeTopic(value, maxLen = DEFAULT_MAX_TOPIC_LEN) {
  const oneLine = collapseToSingleLine(value);
  const trunc = safeTruncate(oneLine || "—", maxLen);
  return {
    value: trunc.text || "—",
    truncated: trunc.truncated,
  };
}

function sanitizeSummary(value, maxLen = DEFAULT_MAX_SUMMARY_LEN) {
  const normalized = normalizeWhitespace(value);
  const trunc = safeTruncate(normalized, maxLen);
  return {
    value: trunc.text,
    truncated: trunc.truncated,
    empty: !trunc.text,
  };
}

function normalizeCard(card = {}, options = {}) {
  const aliasMaxLen = clampNumber(
    options.aliasMaxLen,
    10,
    200,
    DEFAULT_MAX_ALIAS_LEN
  );
  const topicMaxLen = clampNumber(
    options.topicMaxLen,
    10,
    300,
    DEFAULT_MAX_TOPIC_LEN
  );
  const summaryMaxLen = clampNumber(
    options.summaryMaxLen,
    20,
    1000,
    DEFAULT_MAX_SUMMARY_LEN
  );

  const alias = sanitizeAlias(card.group_alias, aliasMaxLen);
  const topic = sanitizeTopic(card.topic, topicMaxLen);
  const summary = sanitizeSummary(card.summary, summaryMaxLen);
  const dateIso = normalizeIsoDate(card.date);
  const confidence = normalizeConfidence(card.confidence);

  return {
    group_alias: alias.value,
    date: dateIso,
    topic: topic.value,
    summary: summary.value,
    confidence,
    meta: {
      aliasTruncated: alias.truncated,
      topicTruncated: topic.truncated,
      summaryTruncated: summary.truncated,
      summaryEmpty: summary.empty,
    },
  };
}

function buildCardLines(card, index) {
  const lines = [];

  lines.push(`${index}. ${card.group_alias}`);
  lines.push(`date=${formatDateShort(card.date)}`);
  lines.push(`topic=${card.topic}`);
  lines.push(`confidence=${formatConfidence(card.confidence)}`);

  if (card.summary) {
    lines.push(`summary=${card.summary}`);
  }

  return lines;
}

export function renderGroupSourceRecallCards(cardsInput = [], options = {}) {
  const cards = Array.isArray(cardsInput) ? cardsInput : [];
  const maxCards = clampNumber(options.maxCards, 1, 50, DEFAULT_MAX_CARDS);
  const maxTotalLen = clampNumber(
    options.maxTotalLen,
    200,
    12000,
    DEFAULT_MAX_TOTAL_LEN
  );

  const normalizedCards = cards.slice(0, maxCards).map((card) =>
    normalizeCard(card, options)
  );

  const meta = {
    contractVersion: 2,
    formatterOnly: true,
    runtimeActive: false,
    sourceFetchingImplemented: false,
    retrievalImplemented: false,
    dbReadsPerformed: false,

    constraints: {
      noAuthorIdentity: true,
      noQuotes: true,
      noRawSnippets: true,
      anonCardsOnly: true,
    },

    inputStats: {
      receivedCards: cards.length,
      renderedCards: normalizedCards.length,
      maxCards,
      maxTotalLen,
    },

    outputStats: {
      totalLength: 0,
      truncatedByTotalLimit: false,
    },
  };

  if (!normalizedCards.length) {
    const text = [
      "RECALL GROUPS:",
      "cards=0",
      "status=empty",
    ].join("\n");

    meta.outputStats.totalLength = text.length;

    return {
      ok: true,
      text,
      meta,
    };
  }

  const lines = ["RECALL GROUPS:", `cards=${normalizedCards.length}`, ""];

  let idx = 0;
  for (const card of normalizedCards) {
    idx += 1;
    lines.push(...buildCardLines(card, idx));
    if (idx < normalizedCards.length) {
      lines.push("");
    }
  }

  let text = lines.join("\n");

  if (text.length > maxTotalLen) {
    text = `${text.slice(0, Math.max(0, maxTotalLen)).trimEnd()}…`;
    meta.outputStats.truncatedByTotalLimit = true;
  }

  meta.outputStats.totalLength = text.length;

  return {
    ok: true,
    text,
    meta,
  };
}

export function renderGroupSourceRecallCardsPreview(cardsInput = [], options = {}) {
  const result = renderGroupSourceRecallCards(cardsInput, options);

  return {
    previewOnly: true,
    result,
  };
}

export default renderGroupSourceRecallCards;