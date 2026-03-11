// src/services/chatMemory/getGroupSourceRecallCandidates.js
// STAGE 8A.8 — GROUP SOURCE RECALL CANDIDATES (RUNTIME STUB ONLY)
//
// IMPORTANT:
// - runtime stub only
// - NO real DB reads
// - NO cross-group retrieval yet
// - NO RecallEngine integration here
// - NO policy bypass
// - NO author identity output
// - NO quotes
// - NO raw snippets
//
// Purpose:
// create one safe runtime boundary for future group-source candidate selection,
// without changing current local /recall behavior and without enabling
// cross-group recall.
//
// Current behavior:
// always returns empty candidates list with explicit "not_enabled_yet" meta.
//
// Workflow boundary:
// - local /recall remains handled by RecallEngine.search()
// - future group-source runtime may call this helper first
// - only after approved next steps may this helper gain real source selection logic

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
  const role = normalizeRole(input.role);

  return {
    role,
    requesterChatId: toSafeString(input.requesterChatId).trim() || null,
    requesterGlobalUserId:
      toSafeString(input.requesterGlobalUserId).trim() || null,
    days: clampNumber(input.days, 1, 30, 1),
    limit: clampNumber(input.limit, 1, 50, 5),
    keyword: toSafeString(input.keyword).trim(),
  };
}

export async function getGroupSourceRecallCandidates(input = {}) {
  const request = buildSafeRequestMeta(input);

  return {
    ok: true,
    candidates: [],
    meta: {
      contractVersion: 1,
      runtimeStub: true,
      runtimeActive: false,
      sourceSelectionImplemented: false,
      dbReadsPerformed: false,
      policyBypassUsed: false,
      safeOutputOnly: true,
      reason: "not_enabled_yet",

      request,
      counters: {
        candidatesFound: 0,
        candidatesReturned: 0,
      },

      constraints: {
        noAuthorIdentity: true,
        noQuotes: true,
        noRawSnippets: true,
        localRecallUnaffected: true,
      },
    },
  };
}

export default getGroupSourceRecallCandidates;