// src/services/chatMemory/getGroupSourceRecallPreview.js
// STAGE 8A.8 / 8A.9 — GROUP SOURCE RECALL PREVIEW (SAFE RUNTIME BRIDGE)
//
// IMPORTANT:
// - safe runtime bridge only
// - NO DB reads here
// - NO source fetching here
// - NO cross-group message retrieval
// - NO author identity output
// - NO quotes
// - NO raw snippets
//
// Purpose:
// create one safe runtime bridge to groupSourceRecallOrchestrator(),
// now accepting already-safe metadata candidates from the candidate helper,
// while still keeping runtime non-invasive.
//
// Current behavior after this step:
// - accepts input.candidates if provided
// - passes them to orchestrator
// - does NOT read messages
// - does NOT enable real cross-group retrieval
// - cards/decisions may become non-zero only from metadata candidates,
//   but rawText remains empty unless a later approved step changes that
//
// Workflow boundary:
// candidate helper -> preview bridge -> orchestrator -> card builder / policy / redaction
// In this step preview bridge becomes candidate-aware, but still content-blind.

import { groupSourceRecallOrchestrator } from "./groupSourceRecallOrchestrator.js";

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

function normalizeIsoDate(value) {
  if (!value) return null;

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  return d.toISOString();
}

function normalizeBoolean(value) {
  return value === true;
}

function normalizeConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function buildSafeRequestMeta(input = {}) {
  return {
    role: normalizeRole(input.role),
    requesterChatId: normalizeChatId(input.requesterChatId),
    requesterGlobalUserId: normalizeChatId(input.requesterGlobalUserId),
    days: clampNumber(input.days, 1, 30, 1),
    limit: clampNumber(input.limit, 1, 50, 5),
    keyword: toSafeString(input.keyword).trim(),
  };
}

function normalizeCandidate(candidate = {}) {
  return {
    platform: toSafeString(candidate.platform || "telegram").trim() || "telegram",
    chatId: normalizeChatId(candidate.chatId),
    alias: toSafeString(candidate.alias).trim(),
    privacyLevel: toSafeString(candidate.privacyLevel).trim() || "private",
    sourceEnabled: normalizeBoolean(candidate.sourceEnabled),

    // hard safety:
    // preview bridge must remain content-blind
    rawText: toSafeString(candidate.rawText).trim(),
    date: normalizeIsoDate(candidate.date),
    confidence: normalizeConfidence(candidate.confidence),

    meta:
      candidate.meta && typeof candidate.meta === "object"
        ? candidate.meta
        : {},
  };
}

function normalizeCandidates(candidatesInput) {
  if (!Array.isArray(candidatesInput)) return [];
  return candidatesInput.map(normalizeCandidate);
}

export async function getGroupSourceRecallPreview(input = {}) {
  const request = buildSafeRequestMeta(input);
  const candidates = normalizeCandidates(input.candidates);

  const orchestrated = await groupSourceRecallOrchestrator({
    role: request.role,
    limit: request.limit,
    candidates,
  });

  const cards = Array.isArray(orchestrated?.cards) ? orchestrated.cards : [];
  const decisions = Array.isArray(orchestrated?.decisions)
    ? orchestrated.decisions
    : [];

  return {
    ok: true,
    cards,
    decisions,
    orchestrated: orchestrated || null,
    meta: {
      contractVersion: 2,
      runtimeStub: false,
      runtimeActive: true,
      dbReadsPerformed: false,
      sourceFetchingImplemented: false,
      candidateSelectionImplemented: Array.isArray(input.candidates),
      retrievalImplemented: false,
      contentReadsPerformed: false,
      policyBypassUsed: false,
      reason: "candidate_aware_preview_only",

      request,

      counters: {
        candidatesReceived: candidates.length,
        cardsReturned: cards.length,
        decisionsReturned: decisions.length,
      },

      constraints: {
        metadataCandidatesAllowed: true,
        noMessageContentReads: true,
        noAuthorIdentity: true,
        noQuotes: true,
        noRawSnippets: true,
      },

      orchestrationMeta:
        orchestrated && typeof orchestrated === "object"
          ? orchestrated.meta || null
          : null,
    },
  };
}

export default getGroupSourceRecallPreview;