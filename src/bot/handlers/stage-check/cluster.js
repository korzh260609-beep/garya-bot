// ============================================================================
// === src/bot/handlers/stage-check/cluster.js
// ============================================================================

import { uniq } from "./common.js";
import {
  isUsefulToken,
  isWeakGenericToken,
  classifySignalEvidence,
} from "./classification.js";

function normalizeClusterToken(token, config, sourceType = "signal") {
  const raw = String(token || "").trim();
  if (!raw) return "";

  const value = raw.startsWith("/") ? raw.slice(1) : raw;
  if (!value) return "";

  if (sourceType === "command") {
    return "";
  }

  if (!isUsefulToken(value, config)) return "";
  return value;
}

function isAtomicClusterToken(token) {
  const raw = String(token || "").trim();
  if (!raw) return false;
  if (raw.includes(" ")) return false;
  if (raw.length > 32) return false;
  return true;
}

function shouldKeepClusterToken(token, sourceKind = "own") {
  const raw = String(token || "").trim();
  const lower = raw.toLowerCase();
  if (!raw) return false;
  if (!isAtomicClusterToken(raw)) return false;

  const strong =
    raw.includes("(") ||
    raw.includes("_") ||
    raw.includes("-") ||
    /^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+$/.test(raw) ||
    /^[A-Z0-9_]{3,}$/.test(raw) ||
    lower.includes("retry") ||
    lower.includes("fail") ||
    lower.includes("error") ||
    lower.includes("reason") ||
    lower.includes("dlq") ||
    lower.includes("dead_letter") ||
    lower.includes("dead-letter") ||
    lower.includes("_at") ||
    lower.includes("backoff") ||
    lower.includes("jitter") ||
    lower.includes("attempt");

  if (strong) return true;

  if (sourceKind === "inherited") return false;
  if (isWeakGenericToken(lower)) return false;

  return raw.length >= 6;
}

function rankClusterToken(token) {
  const raw = String(token || "").trim();
  const lower = raw.toLowerCase();

  let score = 0;

  if (!isAtomicClusterToken(raw)) score -= 12;
  if (/[A-Z]/.test(raw) && /[a-z]/.test(raw)) score += 3;
  if (raw.includes("_")) score += 4;
  if (raw.includes("-")) score += 2;
  if (raw.includes("(")) score += 5;
  if (/^[A-Z0-9_]+$/.test(raw) && raw.length >= 3) score += 2;

  if (lower === "retry") score += 5;
  if (lower === "retries") score += 5;
  if (lower.includes("retry_at")) score += 7;
  if (lower.includes("max_retries")) score += 7;
  if (lower.includes("next_retry_at")) score += 6;
  if (lower.includes("shouldretry")) score += 5;
  if (lower.includes("computebackoffdelayms")) score += 5;

  if (lower.includes("fail_reason")) score += 8;
  if (lower.includes("fail_code")) score += 8;
  if (lower.includes("last_error_at")) score += 8;
  if (lower.includes("failed_at")) score += 7;
  if (lower.includes("failure_reason")) score += 6;
  if (lower.includes("error_code")) score += 6;

  if (lower.includes("dlq")) score += 8;
  if (lower.includes("dead_letter")) score += 7;
  if (lower.includes("dead-letter")) score += 7;
  if (lower.includes("movetodlq")) score += 6;
  if (lower.includes("enabledlq")) score += 6;
  if (lower.includes("_movetodlq")) score += 6;

  if (lower === "can" || lower.startsWith("can(")) score += 5;
  if (lower.includes("permission")) score += 3;
  if (lower.includes("access")) score += 2;
  if (isWeakGenericToken(lower)) score -= 8;

  score += Math.min(raw.length, 20) * 0.05;

  return score;
}

function takeTopTokens(tokens, limit) {
  return uniq(tokens)
    .filter(isAtomicClusterToken)
    .sort((a, b) => rankClusterToken(b) - rankClusterToken(a))
    .slice(0, Math.max(0, limit));
}

function buildEvidenceProfile({ own, inheritedSignals, explicitPaths, commands }) {
  const structural = new Set();
  const behavioral = new Set();
  const observational = new Set();
  const interfaceLike = new Set();
  const relational = new Set();
  const generic = new Set();

  for (const path of explicitPaths || []) structural.add(path);
  for (const cmd of commands || []) interfaceLike.add(cmd);

  for (const token of [...(own || []), ...(inheritedSignals || [])]) {
    const klass = classifySignalEvidence(token);

    if (klass === "structural") structural.add(token);
    else if (klass === "behavioral") behavioral.add(token);
    else if (klass === "observational") observational.add(token);
    else if (klass === "interface") interfaceLike.add(token);
    else if (klass === "relational") relational.add(token);
    else generic.add(token);
  }

  return {
    structural: Array.from(structural),
    behavioral: Array.from(behavioral),
    observational: Array.from(observational),
    interface: Array.from(interfaceLike),
    relational: Array.from(relational),
    generic: Array.from(generic),
  };
}

function buildClusterBuckets({ own, inheritedSignals, config }) {
  const profile = buildEvidenceProfile({
    own: own.signals || [],
    inheritedSignals: inheritedSignals || [],
    explicitPaths: own.explicitPaths || [],
    commands: own.commands || [],
  });

  const buckets = {
    structural: [],
    behavioral: [],
    observational: [],
    interface: [],
    relational: [],
    generic: [],
  };

  for (const token of profile.structural || []) {
    const normalized = normalizeClusterToken(token, config, "signal");
    if (normalized && shouldKeepClusterToken(normalized, "own")) {
      buckets.structural.push(normalized);
    }
  }

  for (const token of profile.behavioral || []) {
    const sourceKind = inheritedSignals.includes(token) ? "inherited" : "own";
    const normalized = normalizeClusterToken(token, config, "signal");
    if (normalized && shouldKeepClusterToken(normalized, sourceKind)) {
      buckets.behavioral.push(normalized);
    }
  }

  for (const token of profile.observational || []) {
    const sourceKind = inheritedSignals.includes(token) ? "inherited" : "own";
    const normalized = normalizeClusterToken(token, config, "signal");
    if (normalized && shouldKeepClusterToken(normalized, sourceKind)) {
      buckets.observational.push(normalized);
    }
  }

  for (const token of profile.interface || []) {
    const sourceKind = inheritedSignals.includes(token) ? "inherited" : "own";
    const normalized = normalizeClusterToken(token, config, "signal");
    if (normalized && shouldKeepClusterToken(normalized, sourceKind)) {
      buckets.interface.push(normalized);
    }
  }

  for (const token of profile.relational || []) {
    const sourceKind = inheritedSignals.includes(token) ? "inherited" : "own";
    const normalized = normalizeClusterToken(token, config, "signal");
    if (normalized && shouldKeepClusterToken(normalized, sourceKind)) {
      buckets.relational.push(normalized);
    }
  }

  for (const token of profile.generic || []) {
    const sourceKind = inheritedSignals.includes(token) ? "inherited" : "own";
    const normalized = normalizeClusterToken(token, config, "signal");
    if (normalized && shouldKeepClusterToken(normalized, sourceKind)) {
      buckets.generic.push(normalized);
    }
  }

  return buckets;
}

function buildClusterTokens({ own, inheritedSignals, config }) {
  const buckets = buildClusterBuckets({ own, inheritedSignals, config });
  const maxTokens = Math.max(1, config.clusterMaxTokens);

  const result = [];
  const bucketOrder = [
    "structural",
    "behavioral",
    "observational",
    "interface",
    "relational",
    "generic",
  ];

  const bucketLimits = {
    structural: 2,
    behavioral: 4,
    observational: 4,
    interface: 2,
    relational: 1,
    generic: 1,
  };

  for (const bucketName of bucketOrder) {
    const picked = takeTopTokens(
      buckets[bucketName] || [],
      bucketLimits[bucketName] || 1
    );
    result.push(...picked);
  }

  if (uniq(result).length < maxTokens) {
    const merged = [];
    for (const bucketName of bucketOrder) {
      merged.push(...(buckets[bucketName] || []));
    }

    for (const token of takeTopTokens(merged, maxTokens * 3)) {
      if (result.length >= maxTokens) break;
      if (!result.includes(token)) result.push(token);
    }
  }

  return uniq(result).slice(0, maxTokens);
}

export function buildClusterCheck({ own, inheritedSignals, config }) {
  const tokens = buildClusterTokens({ own, inheritedSignals, config });
  if (tokens.length < Math.max(3, config.clusterMinMatchedTokens)) return null;

  return {
    type: "signal_cluster_exists",
    tokens,
    minMatchedTokens: Math.max(1, config.clusterMinMatchedTokens),
    minDistinctFiles: Math.max(1, config.clusterMinDistinctFiles),
    strongMatchedTokens: Math.max(
      Math.max(1, config.clusterMinMatchedTokens),
      config.clusterStrongMatchedTokens
    ),
    strongDistinctFiles: Math.max(
      Math.max(1, config.clusterMinDistinctFiles),
      config.clusterStrongDistinctFiles
    ),
    label: `signal cluster: ${tokens.join(", ")}`,
  };
}