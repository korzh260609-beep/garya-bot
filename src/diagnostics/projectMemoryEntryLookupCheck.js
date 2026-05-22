// src/diagnostics/projectMemoryEntryLookupCheck.js
// SG 2.0 — Project Memory entry lookup diagnostics check.
// Read-only lookup by PR number. No Telegram, AI, writes, confirmation, source sync, or runtime mutation.

import { isDatabaseConfigured, queryPostgres } from "../db/postgresClient.js";
import { PROJECT_MEMORY_TABLES } from "../memory/index.js";

export const PROJECT_MEMORY_ENTRY_LOOKUP_CHECK_VERSION = 1;

function pr(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function limit(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.min(25, Math.trunc(n))) : 10;
}

function q(queryFn) {
  return typeof queryFn === "function" ? queryFn : queryPostgres;
}

function db(value) {
  return typeof value === "boolean" ? value : isDatabaseConfigured();
}

function metadata(row = {}) {
  if (!row.metadata) return {};
  if (typeof row.metadata === "object") return row.metadata;
  try { return JSON.parse(row.metadata); } catch { return {}; }
}

function map(row = {}) {
  const meta = metadata(row);
  return {
    id: row.id || "",
    projectKey: row.project_key || "",
    title: row.title || "",
    trust: row.trust || "",
    status: row.status || "",
    sourceType: row.source_type || "",
    sourceRef: row.source_ref || "",
    traceId: row.trace_id || "",
    prNumber: meta.prNumber ?? null,
    confirmedBy: row.confirmed_by || "",
    confirmedAt: row.confirmed_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function warning(code, message, prNumber = null) {
  return { code, message, prNumber };
}

async function read({ prNumber, queryFn, safeLimit }) {
  return q(queryFn)(
    `SELECT id, project_key, title, trust, status, source_type, source_ref, metadata,
            confirmed_by, confirmed_at, created_at, updated_at, trace_id
     FROM ${PROJECT_MEMORY_TABLES.ENTRIES}
     WHERE project_key = 'sg'
       AND (source_ref ILIKE $1 OR title ILIKE $2 OR metadata->>'prNumber' = $3)
     ORDER BY updated_at DESC, created_at DESC
     LIMIT $4`,
    [`%/pull/${prNumber}%`, `%PR #${prNumber}%`, String(prNumber), safeLimit],
  );
}

export async function runProjectMemoryEntryLookupCheck({ prNumber = null, queryFn = null, databaseConfigured = null, limit: max = 10 } = {}) {
  const safePr = pr(prNumber);
  const safeLimit = limit(max);
  const databaseConfiguredSafe = db(databaseConfigured);

  if (!safePr) {
    return {
      ok: false,
      type: "project_memory_entry_lookup_check",
      version: PROJECT_MEMORY_ENTRY_LOOKUP_CHECK_VERSION,
      summary: "Project Memory entry lookup skipped: valid prNumber is required.",
      details: { databaseConfigured: databaseConfiguredSafe, checked: false, prNumber: null, found: false, confirmedActiveFound: false, entries: [] },
      warnings: [warning("missing_valid_pr_number", "A positive integer prNumber is required.")],
      sanitized: true,
      readOnly: true,
    };
  }

  if (!databaseConfiguredSafe) {
    return {
      ok: false,
      type: "project_memory_entry_lookup_check",
      version: PROJECT_MEMORY_ENTRY_LOOKUP_CHECK_VERSION,
      summary: `Project Memory entry lookup for PR #${safePr} skipped: database is not configured.`,
      details: { databaseConfigured: false, checked: false, prNumber: safePr, found: false, confirmedActiveFound: false, entries: [] },
      warnings: [warning("database_not_configured", "Project Memory entry lookup cannot verify live storage without database configuration.", safePr)],
      sanitized: true,
      readOnly: true,
    };
  }

  const result = await read({ prNumber: safePr, queryFn, safeLimit });
  if (!result.ok) {
    return {
      ok: false,
      type: "project_memory_entry_lookup_check",
      version: PROJECT_MEMORY_ENTRY_LOOKUP_CHECK_VERSION,
      summary: `Project Memory entry lookup for PR #${safePr} failed.`,
      details: { databaseConfigured: true, checked: false, prNumber: safePr, found: false, confirmedActiveFound: false, entries: [] },
      warnings: [warning("project_memory_entry_lookup_query_failed", "Project Memory entry lookup query failed.", safePr)],
      sanitized: true,
      readOnly: true,
      reason: result.reason || "project_memory_entry_lookup_query_failed",
    };
  }

  const entries = (result.rows || []).map(map);
  const confirmedActiveFound = entries.some((entry) => entry.trust === "confirmed" && entry.status === "active");
  const warnings = [];
  if (!entries.length) warnings.push(warning("project_memory_entry_not_found", "No Project Memory entry matched this PR number.", safePr));
  if (entries.length && !confirmedActiveFound) warnings.push(warning("project_memory_entry_found_but_not_confirmed_active", "Entry exists, but no matched entry is confirmed and active.", safePr));

  return {
    ok: confirmedActiveFound,
    type: "project_memory_entry_lookup_check",
    version: PROJECT_MEMORY_ENTRY_LOOKUP_CHECK_VERSION,
    summary: entries.length
      ? `Project Memory entry lookup for PR #${safePr}: found=${entries.length}, confirmed_active=${confirmedActiveFound}.`
      : `Project Memory entry lookup for PR #${safePr}: no entries found.`,
    details: { databaseConfigured: true, checked: true, prNumber: safePr, found: entries.length > 0, confirmedActiveFound, entries },
    warnings,
    sanitized: true,
    readOnly: true,
  };
}

export default { runProjectMemoryEntryLookupCheck };
