/**
 * Decision Telemetry
 *
 * Responsibility:
 * - stores sandbox replay analytics in isolated in-memory telemetry
 * - optionally mirrors telemetry into DB (fail-open)
 * - provides aggregated diagnostics for Decision Layer evolution
 *
 * IMPORTANT:
 * - sandbox only
 * - must NEVER affect production responses
 * - DB write is mirror-only and fail-open
 */

import { insertDecisionTelemetry } from "../db/decisionTelemetryRepo.js";

const DECISION_TELEMETRY_LIMIT = 100;

const decisionTelemetryStore = [];

function createTelemetryRecord(replay = {}, analysis = {}) {
  return {
    savedAt: Date.now(),
    ok: replay?.ok || false,
    mode: replay?.mode || "replay",

    baseline: replay?.baseline || null,
    shadow: replay?.shadow || null,
    compare: replay?.compare || null,

    analysis: analysis || null,
  };
}

function trimDecisionTelemetry() {
  while (decisionTelemetryStore.length > DECISION_TELEMETRY_LIMIT) {
    decisionTelemetryStore.shift();
  }
}

export function saveDecisionTelemetry(replay = {}, analysis = {}) {
  const record = createTelemetryRecord(replay, analysis);

  decisionTelemetryStore.push(record);
  trimDecisionTelemetry();

  // DB mirror (fail-open, no await, no production impact)
  Promise.resolve()
    .then(() =>
      insertDecisionTelemetry({
        ok: record.ok,
        mode: record.mode,
        baseline: record.baseline,
        shadow: record.shadow,
        compare: record.compare,
        analysis: record.analysis,
        schemaVersion: 1,
      })
    )
    .catch((e) => {
      console.error("ERROR decision_telemetry mirror insert failed (fail-open):", e);
    });

  return record;
}

export function getDecisionTelemetry() {
  return [...decisionTelemetryStore];
}

export function getRecentDecisionTelemetry(limit = 10) {
  const normalizedLimit =
    typeof limit === "number" && limit > 0
      ? Math.min(Math.floor(limit), DECISION_TELEMETRY_LIMIT)
      : 10;

  return decisionTelemetryStore.slice(-normalizedLimit);
}

export function getDecisionTelemetrySize() {
  return decisionTelemetryStore.length;
}

export function clearDecisionTelemetry() {
  decisionTelemetryStore.length = 0;

  return {
    ok: true,
    cleared: true,
    size: 0,
  };
}

export function getDecisionTelemetryStats() {
  const records = getDecisionTelemetry();

  const stats = {
    total: records.length,
    shadowBetter: 0,
    baselineBetter: 0,
    equal: 0,
    sameFinalText: 0,
    sameRoute: 0,
    avgDurationMs: 0,
  };

  if (records.length === 0) {
    return stats;
  }

  let totalDuration = 0;

  for (const record of records) {
    const improvement = record?.analysis?.decisionQuality?.improvement || "equal";

    if (improvement === "shadow_better") {
      stats.shadowBetter += 1;
    } else if (improvement === "baseline_better") {
      stats.baselineBetter += 1;
    } else {
      stats.equal += 1;
    }

    if (record?.analysis?.decisionQuality?.sameFinalText === true) {
      stats.sameFinalText += 1;
    }

    if (record?.analysis?.decisionQuality?.sameRoute === true) {
      stats.sameRoute += 1;
    }

    totalDuration += record?.analysis?.performance?.durationMs || 0;
  }

  stats.avgDurationMs = Number((totalDuration / records.length).toFixed(2));

  return stats;
}