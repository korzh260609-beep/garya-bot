// src/bot/handlers/chat/behaviorSnapshot.js
//
// Goal:
// - create a safe, small snapshot of BehaviorCore state for logs
// - no side effects
// - no DB
// - no AI
//
// IMPORTANT:
// - this is for observability only
// - does NOT control runtime behavior
// - behavior logic remains in behaviorCore.js / systemPrompt.js

import { getBehaviorCore } from "../../../core/behaviorCore.js";

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeSlots(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();

  for (const item of value) {
    const s = safeStr(item).trim();
    if (!s) continue;

    const key = s.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(s);
  }

  return out;
}

export function buildBehaviorSnapshot({
  userText = "",
  styleAxis = null,
  criticality = null,
  intent = null,
} = {}) {
  const core = getBehaviorCore({
    text: safeStr(userText),
    styleAxis,
    criticality,
  });

  const stableIntentMode =
    typeof intent?.mode === "string" ? intent.mode : "unknown";
  const stableIntentDomain =
    typeof intent?.domain === "string" ? intent.domain : "unknown";
  const stableIntentCandidateSlots = normalizeSlots(intent?.candidateSlots);

  return {
    behaviorVersion: safeStr(core?.version || "unknown"),
    behaviorStyleAxis: safeStr(core?.styleAxis || "unknown"),
    behaviorStyleAxisSource: safeStr(core?.styleAxisSource || "unknown"),
    behaviorSoftStyleAskDetected: Boolean(core?.softStyleAskDetected),
    behaviorCriticality: safeStr(core?.criticality || "unknown"),
    behaviorCriticalitySource: safeStr(core?.criticalitySource || "unknown"),
    behaviorNoNodding: Boolean(core?.noNodding),
    stableIntentMode,
    stableIntentDomain,
    stableIntentCandidateSlots,
  };
}

export default buildBehaviorSnapshot;