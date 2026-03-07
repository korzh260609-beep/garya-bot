// src/db/decisionTelemetryRepo.js
// Decision telemetry DB layer
// Purpose: optional persistent mirror for in-memory decision telemetry.
// IMPORTANT:
// - fail-open only
// - no reads yet
// - no production routing impact

import pool from "../../db.js";

export async function insertDecisionTelemetry({
  ok = false,
  mode = "replay",
  baseline = null,
  shadow = null,
  compare = null,
  analysis = null,
  schemaVersion = 1,
}) {
  const res = await pool.query(
    `
    INSERT INTO decision_telemetry (
      ok,
      mode,
      baseline,
      shadow,
      compare,
      analysis,
      schema_version
    )
    VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7)
    RETURNING id, saved_at
    `,
    [
      Boolean(ok),
      String(mode || "replay"),
      JSON.stringify(baseline),
      JSON.stringify(shadow),
      JSON.stringify(compare),
      JSON.stringify(analysis),
      Number(schemaVersion || 1),
    ]
  );

  return {
    inserted: true,
    id: res.rows?.[0]?.id ?? null,
    savedAt: res.rows?.[0]?.saved_at ?? null,
  };
}