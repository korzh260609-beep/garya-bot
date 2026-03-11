// src/services/chatMemory/getGroupSourceRecallPreview.js
// STAGE 8A.8 / 8A.9 — GROUP SOURCE RECALL PREVIEW (RUNTIME STUB ONLY)
//
// IMPORTANT:
// - runtime stub only
// - NO DB reads
// - NO source fetching
// - NO real candidate selection
// - NO cross-group retrieval
// - NO author identity output
// - NO quotes
// - NO raw snippets
//
// Purpose:
// create one safe runtime bridge to groupSourceRecallOrchestrator(),
// while keeping candidates empty and runtime behavior non-invasive.
//
// Current behavior:
// - always calls orchestrator with candidates: []
// - always returns safe preview-like empty result
// - does NOT enable cross-group retrieval
//
// Workflow boundary:
// candidate helper -> preview bridge -> orchestrator -> card builder / policy / redaction
// but all with empty candidate input for now

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

function buildSafeRequestMeta(input = {}) {
  return {
    role: normalizeRole(input.role),
    requesterChatId: toSafeString(input.requesterChatId).trim() || null,
    requesterGlobalUserId:
      toSafeString(input.requesterGlobalUserId).trim() || null,
    days: clampNumber(input.days, 1, 30, 1),
    limit: clampNumber(input.limit, 1, 50, 5),
    keyword: toSafeString(input.keyword).trim(),
  };
}

export async function getGroupSourceRecallPreview(input = {}) {
  const request = buildSafeRequestMeta(input);

  const orchestrated = await groupSourceRecallOrchestrator({
    role: request.role,
    limit: request.limit,
    candidates: [],
  });

  return {
    ok: true,
    cards: Array.isArray(orchestrated?.cards) ? orchestrated.cards : [],
    decisions: Array.isArray(orchestrated?.decisions)
      ? orchestrated.decisions
      : [],
    orchestrated: orchestrated || null,
    meta: {
      contractVersion: 1,
      runtimeStub: true,
      runtimeActive: false,
      dbReadsPerformed: false,
      sourceFetchingImplemented: false,
      candidateSelectionImplemented: false,
      retrievalImplemented: false,
      policyBypassUsed: false,
      reason: "not_enabled_yet",

      request,

      counters: {
        cardsReturned: Array.isArray(orchestrated?.cards)
          ? orchestrated.cards.length
          : 0,
        decisionsReturned: Array.isArray(orchestrated?.decisions)
          ? orchestrated.decisions.length
          : 0,
      },

      constraints: {
        emptyCandidatesOnly: true,
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