// src/services/chatMemory/buildGroupSourceRecallCard.js
// STAGE 8A.8 / 8A.9 — GROUP SOURCE RECALL CARD (SKELETON ONLY)
//
// IMPORTANT:
// - skeleton only
// - NO runtime wiring yet
// - NO /recall integration yet
// - NO DB reads here
// - NO cross-group retrieval here
// - NO author identity output
// - NO raw snippets output
// - NO verbatim quotes output
//
// Purpose:
// define one future-safe output contract for anonymized cross-group/group-source
// recall cards, after redaction + policy evaluation.
//
// Expected future dependency chain:
// raw source text
//   -> Stage 7B.10 redaction contract
//   -> Stage 11.17 policy contract
//   -> this card builder
//
// Hard rule:
// this file must remain preview/skeleton only until explicit approved runtime wiring.

import { redactGroupSourceText } from "./groupSourceRedaction.js";
import { evaluateGroupSourcePolicy } from "../../access/groupSourcePolicy.js";

const DEFAULT_SUMMARY_MAX_LEN = 280;
const DEFAULT_TOPIC_MAX_LEN = 80;

function toSafeString(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function normalizeWhitespace(text = "") {
  return toSafeString(text)
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
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

function collapseToSingleLine(text = "") {
  return normalizeWhitespace(text).replace(/\n+/g, " ").trim();
}

function buildTopicCandidate(text = "", maxLen = DEFAULT_TOPIC_MAX_LEN) {
  const singleLine = collapseToSingleLine(text);

  if (!singleLine) {
    return {
      topic: "—",
      truncated: false,
      empty: true,
    };
  }

  const trunc = safeTruncate(singleLine, maxLen);

  return {
    topic: trunc.text || "—",
    truncated: trunc.truncated,
    empty: false,
  };
}

function buildSummaryCandidate(text = "", maxLen = DEFAULT_SUMMARY_MAX_LEN) {
  const normalized = normalizeWhitespace(text);

  if (!normalized) {
    return {
      summary: "",
      truncated: false,
      empty: true,
      source: "none",
    };
  }

  const trunc = safeTruncate(normalized, maxLen);

  return {
    summary: trunc.text,
    truncated: trunc.truncated,
    empty: false,
    source: "redacted_text",
  };
}

function normalizeDate(value) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function normalizeConfidence(value) {
  return clampNumber(value, 0, 1, 0.5);
}

function buildDeniedCard(reason, meta = {}) {
  return {
    allowed: false,
    card: null,
    denyReason: reason,
    meta,
  };
}

function buildSafeMetadataTopic(input = {}, topicMaxLen = DEFAULT_TOPIC_MAX_LEN) {
  const rawTopic =
    toSafeString(input?.safeTopic) ||
    toSafeString(input?.meta?.safeTopic) ||
    toSafeString(input?.meta?.topic);

  const singleLine = collapseToSingleLine(rawTopic);

  if (!singleLine) {
    return {
      topic: "—",
      truncated: false,
      empty: true,
      source: "none",
    };
  }

  const trunc = safeTruncate(singleLine, topicMaxLen);

  return {
    topic: trunc.text || "—",
    truncated: trunc.truncated,
    empty: false,
    source: "metadata",
  };
}

function normalizeMetaNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  return Math.trunc(n);
}

function buildSafeMetadataSummary(input = {}, maxLen = DEFAULT_SUMMARY_MAX_LEN) {
  const meta = input?.meta && typeof input.meta === "object" ? input.meta : {};

  const privacyLevel = toSafeString(input?.privacyLevel).trim() || "private";
  const messageCount = normalizeMetaNumber(meta.messageCount);
  const lastMessageAt = normalizeDate(meta.lastMessageAt || meta.updatedAt || input?.date);

  const parts = [
    `privacy=${privacyLevel}`,
    messageCount == null ? "" : `messages=${messageCount}`,
    lastMessageAt ? `last=${lastMessageAt.slice(0, 16)}` : "",
  ].filter(Boolean);

  const singleLine = collapseToSingleLine(parts.join(" | "));

  if (!singleLine) {
    return {
      summary: "",
      truncated: false,
      empty: true,
      source: "none",
    };
  }

  const trunc = safeTruncate(singleLine, maxLen);

  return {
    summary: trunc.text,
    truncated: trunc.truncated,
    empty: false,
    source: "metadata",
  };
}

export function buildGroupSourceRecallCard(input = {}) {
  const rawText = toSafeString(input.rawText);
  const alias = toSafeString(input.alias).trim();
  const dateIso = normalizeDate(input.date);
  const confidence = normalizeConfidence(input.confidence);

  const summaryMaxLen = clampNumber(
    input.summaryMaxLen,
    80,
    800,
    DEFAULT_SUMMARY_MAX_LEN
  );

  const topicMaxLen = clampNumber(
    input.topicMaxLen,
    20,
    160,
    DEFAULT_TOPIC_MAX_LEN
  );

  const policy = evaluateGroupSourcePolicy({
    role: input.role,
    privacyLevel: input.privacyLevel,
    sourceEnabled: input.sourceEnabled,
    alias,
  });

  const meta = {
    contractVersion: 4,
    skeletonOnly: true,
    runtimeActive: false,

    pipeline: {
      redactionApplied: false,
      policyEvaluated: true,
      outputMode: "anon_card_only",
      metadataTopicChecked: true,
      metadataTopicUsed: false,
      metadataSummaryChecked: true,
      metadataSummaryUsed: false,
    },

    constraints: {
      noAuthorIdentity: true,
      noQuotes: true,
      noRawSnippets: true,
      localPreviewOnly: true,
    },

    inputs: {
      aliasPresent: Boolean(alias),
      rawTextLength: rawText.length,
      dateIso,
      confidence,
      summaryMaxLen,
      topicMaxLen,
    },

    policyMeta: policy.meta || null,
  };

  if (!policy.allowed) {
    return buildDeniedCard(policy.denyReason || "policy_denied", meta);
  }

  const redaction = redactGroupSourceText(rawText, {
    removeMentions: true,
    removeProfileLinks: true,
    removeEmails: true,
    removePhones: true,
    removeExplicitIdentifiers: true,
    removeQuotes: true,
    maxLen: summaryMaxLen,
  });

  meta.pipeline.redactionApplied = true;
  meta.redactionMeta = redaction.meta || null;

  const metadataTopicCandidate = buildSafeMetadataTopic(input, topicMaxLen);
  const topicCandidate = metadataTopicCandidate.empty
    ? buildTopicCandidate(redaction.redactedText, topicMaxLen)
    : metadataTopicCandidate;

  if (!metadataTopicCandidate.empty) {
    meta.pipeline.metadataTopicUsed = true;
  }

  const redactedSummaryCandidate = buildSummaryCandidate(
    redaction.redactedText,
    summaryMaxLen
  );

  const metadataSummaryCandidate = buildSafeMetadataSummary(input, summaryMaxLen);
  const summaryCandidate = redactedSummaryCandidate.empty
    ? metadataSummaryCandidate
    : redactedSummaryCandidate;

  if (!metadataSummaryCandidate.empty && redactedSummaryCandidate.empty) {
    meta.pipeline.metadataSummaryUsed = true;
  }

  const card = {
    group_alias: alias || "—",
    date: dateIso,
    topic: policy.visibility === "none" ? "—" : topicCandidate.topic,
    summary:
      policy.visibility === "alias_and_summary"
        ? summaryCandidate.summary
        : "",
    confidence,
  };

  meta.output = {
    topicEmpty: topicCandidate.empty,
    topicTruncated: topicCandidate.truncated,
    topicSource: topicCandidate.source || "redacted_text",
    summaryEmpty: summaryCandidate.empty,
    summaryTruncated: summaryCandidate.truncated,
    summarySource: summaryCandidate.source || "none",
    visibility: policy.visibility,
  };

  return {
    allowed: true,
    card,
    denyReason: null,
    meta,
  };
}

export function buildGroupSourceRecallCardPreview(input = {}) {
  const result = buildGroupSourceRecallCard(input);

  return {
    previewOnly: true,
    result,
  };
}

export default buildGroupSourceRecallCard;