// src/services/chatMemory/groupSourceRecallOrchestrator.js
// STAGE 8A.8 / 8A.9 — GROUP SOURCE RECALL ORCHESTRATOR (SKELETON ONLY)
//
// IMPORTANT:
// - skeleton only
// - NO runtime wiring yet
// - NO /recall integration yet
// - NO DB access yet
// - NO source fetching yet
// - NO cross-group retrieval implementation yet
// - NO command wiring yet
//
// Purpose:
// define one future orchestration boundary for cross-group/group-source recall,
// keeping these responsibilities separated:
// 1) candidate source selection
// 2) per-source policy evaluation
// 3) redaction
// 4) anon card building
//
// Hard rule:
// this file must remain preview/orchestration contract only until a separate
// approved runtime step wires it into recall flow.

import { evaluateGroupSourcePolicy } from "../../access/groupSourcePolicy.js";
import { buildGroupSourceRecallCard } from "./buildGroupSourceRecallCard.js";

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
  return n;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeLimit(value, fallback = 5) {
  return clampNumber(value, 1, 50, fallback);
}

function normalizeCandidate(candidate = {}) {
  const meta =
    candidate.meta && typeof candidate.meta === "object" ? candidate.meta : {};

  return {
    platform: toSafeString(candidate.platform || "telegram").trim() || "telegram",
    chatId: toSafeString(candidate.chatId).trim(),
    alias: toSafeString(candidate.alias).trim(),
    privacyLevel: toSafeString(candidate.privacyLevel).trim(),
    sourceEnabled: candidate.sourceEnabled === true,
    rawText: toSafeString(candidate.rawText),
    date: candidate.date || null,
    confidence: candidate.confidence,
    meta,
    safeTopic:
      toSafeString(candidate.safeTopic).trim() ||
      toSafeString(meta.safeTopic).trim() ||
      toSafeString(meta.topic).trim() ||
      "",
  };
}

function buildDeniedCandidate(reason, candidate, policy = null) {
  return {
    accepted: false,
    reason,
    candidate: {
      platform: candidate.platform,
      chatId: candidate.chatId,
      alias: candidate.alias,
      privacyLevel: candidate.privacyLevel,
      sourceEnabled: candidate.sourceEnabled,
      safeTopicPresent: Boolean(candidate.safeTopic),
    },
    policy,
    card: null,
  };
}

export async function groupSourceRecallOrchestrator(input = {}) {
  const role = toSafeString(input.role).trim().toLowerCase() || "guest";
  const candidates = normalizeArray(input.candidates).map(normalizeCandidate);
  const limit = normalizeLimit(input.limit, 5);

  const meta = {
    contractVersion: 2,
    skeletonOnly: true,
    runtimeActive: false,

    stageBoundary: "8A.8_orchestration",
    intendedConsumers: ["future_recall_service", "future_group_source_recall"],
    sourceSelectionImplemented: false,
    dbFetchingImplemented: false,
    commandWired: false,

    inputStats: {
      requestedCandidates: candidates.length,
      limit,
      role,
      candidatesWithSafeTopic: candidates.filter((c) => Boolean(c.safeTopic)).length,
    },

    counters: {
      accepted: 0,
      denied: 0,
      deniedSourceDisabled: 0,
      deniedAliasRequired: 0,
      deniedPolicy: 0,
      deniedOther: 0,
      metadataTopicPassedToCard: 0,
    },
  };

  const decisions = [];
  const cards = [];

  for (const candidate of candidates) {
    if (cards.length >= limit) break;

    if (!candidate.sourceEnabled) {
      meta.counters.denied += 1;
      meta.counters.deniedSourceDisabled += 1;
      decisions.push(buildDeniedCandidate("source_disabled", candidate, null));
      continue;
    }

    if (!candidate.alias) {
      meta.counters.denied += 1;
      meta.counters.deniedAliasRequired += 1;
      decisions.push(buildDeniedCandidate("alias_required", candidate, null));
      continue;
    }

    const policy = evaluateGroupSourcePolicy({
      role,
      privacyLevel: candidate.privacyLevel,
      sourceEnabled: candidate.sourceEnabled,
      alias: candidate.alias,
    });

    if (!policy.allowed) {
      meta.counters.denied += 1;
      meta.counters.deniedPolicy += 1;
      decisions.push(
        buildDeniedCandidate(
          policy.denyReason || "policy_denied",
          candidate,
          {
            allowed: policy.allowed,
            visibility: policy.visibility,
            denyReason: policy.denyReason,
            meta: policy.meta || null,
          }
        )
      );
      continue;
    }

    const cardResult = buildGroupSourceRecallCard({
      role,
      alias: candidate.alias,
      privacyLevel: candidate.privacyLevel,
      sourceEnabled: candidate.sourceEnabled,
      rawText: candidate.rawText,
      date: candidate.date,
      confidence: candidate.confidence,
      safeTopic: candidate.safeTopic,
      meta: candidate.meta,
    });

    if (candidate.safeTopic) {
      meta.counters.metadataTopicPassedToCard += 1;
    }

    if (!cardResult.allowed || !cardResult.card) {
      meta.counters.denied += 1;
      meta.counters.deniedOther += 1;
      decisions.push(
        buildDeniedCandidate(
          cardResult.denyReason || "card_build_denied",
          candidate,
          {
            allowed: policy.allowed,
            visibility: policy.visibility,
            denyReason: policy.denyReason,
            meta: policy.meta || null,
          }
        )
      );
      continue;
    }

    meta.counters.accepted += 1;

    decisions.push({
      accepted: true,
      reason: null,
      candidate: {
        platform: candidate.platform,
        chatId: candidate.chatId,
        alias: candidate.alias,
        privacyLevel: candidate.privacyLevel,
        sourceEnabled: candidate.sourceEnabled,
        safeTopicPresent: Boolean(candidate.safeTopic),
      },
      policy: {
        allowed: policy.allowed,
        visibility: policy.visibility,
        denyReason: policy.denyReason,
        meta: policy.meta || null,
      },
      card: cardResult.card,
      cardMeta: cardResult.meta || null,
    });

    cards.push(cardResult.card);
  }

  return {
    ok: true,
    cards,
    decisions,
    meta,
  };
}

export async function buildGroupSourceRecallPreview(input = {}) {
  const result = await groupSourceRecallOrchestrator(input);

  return {
    previewOnly: true,
    result,
  };
}

export default groupSourceRecallOrchestrator;