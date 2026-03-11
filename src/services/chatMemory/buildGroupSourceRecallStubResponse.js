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
  return (
    safeText(input?.previewResult?.meta?.reason, 80) ||
    safeText(input?.candidateResult?.meta?.reason, 80) ||
    "not_enabled_yet"
  );
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

function extractRenderedCardBlock(input = {}) {
  const rawOriginal = toSafeString(input?.renderedResult?.text);
  const raw = rawOriginal.trim();

  if (!raw) {
    return {
      text: "",
      shown: false,
      debug: {
        rawLength: rawOriginal.length,
        trimmedLength: raw.length,
        lineCount: 0,
        firstLine: "",
        secondLine: "",
        bodyLength: 0,
      },
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
    debug: {
      rawLength: rawOriginal.length,
      trimmedLength: raw.length,
      lineCount: lines.length,
      firstLine: safeText(lines[0] || "", 80),
      secondLine: safeText(lines[1] || "", 80),
      bodyLength: body.length,
    },
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

  const renderedPreview = extractRenderedCardBlock(input);

  const lines = [
    "RECALL GROUPS: not_enabled_yet",
    "scope=include_groups",
    `days=${days}`,
    `limit=${limit}`,
    keyword ? `keyword=${keyword}` : "",
    `reason=${reason}`,
    `cards_rendered=${cardsRendered}`,
    `preview_cards=${previewCards}`,
    `preview_decisions=${previewDecisions}`,
    renderedPreview.shown ? "safe_preview_cards_shown=true" : "safe_preview_cards_shown=false",
    `debug_render_raw_length=${renderedPreview.debug.rawLength}`,
    `debug_render_trimmed_length=${renderedPreview.debug.trimmedLength}`,
    `debug_render_line_count=${renderedPreview.debug.lineCount}`,
    renderedPreview.debug.firstLine ? `debug_render_first_line=${renderedPreview.debug.firstLine}` : "",
    renderedPreview.debug.secondLine ? `debug_render_second_line=${renderedPreview.debug.secondLine}` : "",
    `debug_render_body_length=${renderedPreview.debug.bodyLength}`,
    "",
    "Stage 7B.10 / 11.17 / 8A.9 foundations are present.",
    "Group candidate runtime boundary exists.",
    "Group card formatter boundary exists.",
    "Group orchestration preview boundary exists.",
    "Runtime cross-group retrieval is not wired yet.",
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
      contractVersion: 3,
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

      preview: {
        safePreviewCardsShown: renderedPreview.shown,
        safePreviewTextLength: renderedPreview.text.length,
        debug: renderedPreview.debug,
      },

      reason,
      totalLength: text.length,
    },
  };
}

export default buildGroupSourceRecallStubResponse;