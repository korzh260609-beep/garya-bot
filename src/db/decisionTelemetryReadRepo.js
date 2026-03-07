// src/db/decisionTelemetryReadRepo.js
// Read-only DB diagnostics for Decision telemetry.
// IMPORTANT:
// - read-only only
// - no production routing impact
// - fail-open behavior stays at handler level

import pool from "../../db.js";

export async function getDecisionTelemetryDbCount() {
  const res = await pool.query(`
    SELECT COUNT(*)::int AS count
    FROM decision_telemetry
  `);

  return res.rows?.[0]?.count ?? 0;
}

export async function getDecisionTelemetryDbStats() {
  const res = await pool.query(`
    SELECT
      COUNT(*)::int AS total,

      COUNT(*) FILTER (
        WHERE COALESCE(analysis->'decisionQuality'->>'improvement', 'equal') = 'shadow_better'
      )::int AS shadow_better,

      COUNT(*) FILTER (
        WHERE COALESCE(analysis->'decisionQuality'->>'improvement', 'equal') = 'baseline_better'
      )::int AS baseline_better,

      COUNT(*) FILTER (
        WHERE COALESCE(analysis->'decisionQuality'->>'improvement', 'equal') = 'equal'
      )::int AS equal,

      COUNT(*) FILTER (
        WHERE COALESCE((analysis->'decisionQuality'->>'sameFinalText')::boolean, false) = true
      )::int AS same_final_text,

      COUNT(*) FILTER (
        WHERE COALESCE((analysis->'decisionQuality'->>'sameRoute')::boolean, false) = true
      )::int AS same_route,

      COALESCE(ROUND(AVG(COALESCE((analysis->'performance'->>'durationMs')::numeric, 0)), 2), 0)::float AS avg_duration_ms
    FROM decision_telemetry
  `);

  const row = res.rows?.[0] || {};

  return {
    total: row.total ?? 0,
    shadowBetter: row.shadow_better ?? 0,
    baselineBetter: row.baseline_better ?? 0,
    equal: row.equal ?? 0,
    sameFinalText: row.same_final_text ?? 0,
    sameRoute: row.same_route ?? 0,
    avgDurationMs: Number(row.avg_duration_ms ?? 0),
  };
}

export async function getDecisionTelemetryDbLast() {
  const res = await pool.query(`
    SELECT
      id,
      saved_at,
      ok,
      mode,
      baseline,
      shadow,
      compare,
      analysis,
      schema_version
    FROM decision_telemetry
    ORDER BY saved_at DESC, id DESC
    LIMIT 1
  `);

  const row = res.rows?.[0];
  if (!row) return null;

  return {
    id: row.id ?? null,
    savedAt: row.saved_at ?? null,
    ok: row.ok ?? false,
    mode: row.mode ?? "replay",
    baseline: row.baseline ?? null,
    shadow: row.shadow ?? null,
    compare: row.compare ?? null,
    analysis: row.analysis ?? null,
    schemaVersion: row.schema_version ?? 1,
  };
}