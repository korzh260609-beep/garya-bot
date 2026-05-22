// src/diagnostics/projectMemoryEntryLookupCheck.js
// SG 2.0 — Project Memory entry lookup diagnostics check.
// Read-only lookup by PR number. No Telegram, AI, writes, confirmation, source sync, or runtime mutation.

import { isDatabaseConfigured, queryPostgres } from "../db/postgresClient.js";
import { PROJECT_MEMORY_TABLES } from "../memory/index.js";

export const PROJECT_MEMORY_ENTRY_LOOKUP_CHECK_VERSION = 2;

const QUERY_PATTERN_KEYS = Object.freeze({
  SOURCE_REF_PULL_URL: "source_ref:/pull/{prNumber}",
  TITLE_PR_HASH: "title:PR #{prNumber}",
  METADATA_PR_NUMBER: "metadata.prNumber",
  NEAR_SOURCE_REF_NUMBER: "near:source_ref contains {prNumber}",
  NEAR_TITLE_NUMBER: "near:title contains {prNumber}",
  NEAR_METADATA_NUMBER: "near:metadata text contains {prNumber}",
  NEAR_TRACE_ID_NUMBER: "near:trace_id contains {prNumber}",
});

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

function safeType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function metadataShape(value, depth = 0) {
  if (depth >= 2) return safeType(value);
  if (Array.isArray(value)) {
    return value.length > 0 ? [`array:${safeType(value[0])}`] : [];
  }
  if (!value || typeof value !== "object") return safeType(value);

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 25)
      .map(([key, nested]) => [key, metadataShape(nested, depth + 1)]),
  );
}

function metadataKeys(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value).sort();
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
    metadataKeys: metadataKeys(meta),
    metadataShape: metadataShape(meta),
    confirmedBy: row.confirmed_by || "",
    confirmedAt: row.confirmed_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function warning(code, message, prNumber = null) {
  return { code, message, prNumber };
}

function buildQueryEvidence(prNumber) {
  return {
    requestedPrNumber: prNumber,
    exactPatternsApplied: [
      {
        key: QUERY_PATTERN_KEYS.SOURCE_REF_PULL_URL,
        field: "source_ref",
        operator: "ILIKE",
        value: `%/pull/${prNumber}%`,
      },
      {
        key: QUERY_PATTERN_KEYS.TITLE_PR_HASH,
        field: "title",
        operator: "ILIKE",
        value: `%PR #${prNumber}%`,
      },
      {
        key: QUERY_PATTERN_KEYS.METADATA_PR_NUMBER,
        field: "metadata->>'prNumber'",
        operator: "=",
        value: String(prNumber),
      },
    ],
    nearPatternsApplied: [
      {
        key: QUERY_PATTERN_KEYS.NEAR_SOURCE_REF_NUMBER,
        field: "source_ref",
        operator: "ILIKE",
        value: `%${prNumber}%`,
      },
      {
        key: QUERY_PATTERN_KEYS.NEAR_TITLE_NUMBER,
        field: "title",
        operator: "ILIKE",
        value: `%${prNumber}%`,
      },
      {
        key: QUERY_PATTERN_KEYS.NEAR_METADATA_NUMBER,
        field: "metadata::text",
        operator: "ILIKE",
        value: `%${prNumber}%`,
      },
      {
        key: QUERY_PATTERN_KEYS.NEAR_TRACE_ID_NUMBER,
        field: "trace_id",
        operator: "ILIKE",
        value: `%${prNumber}%`,
      },
    ],
  };
}

async function readExact({ prNumber, queryFn, safeLimit }) {
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

async function readNear({ prNumber, queryFn, safeLimit }) {
  return q(queryFn)(
    `SELECT id, project_key, title, trust, status, source_type, source_ref, metadata,
            confirmed_by, confirmed_at, created_at, updated_at, trace_id
     FROM ${PROJECT_MEMORY_TABLES.ENTRIES}
     WHERE source_ref ILIKE $1
        OR title ILIKE $1
        OR metadata::text ILIKE $1
        OR trace_id ILIKE $1
     ORDER BY updated_at DESC, created_at DESC
     LIMIT $2`,
    [`%${prNumber}%`, safeLimit],
  );
}

function emptyDetails({ databaseConfigured, checked, prNumber, queryEvidence }) {
  return {
    databaseConfigured,
    checked,
    requestedPrNumber: prNumber,
    prNumber,
    found: false,
    confirmedActiveFound: false,
    queryPatternsApplied: queryEvidence,
    exactMatches: [],
    nearMatches: [],
    entries: [],
  };
}

export async function runProjectMemoryEntryLookupCheck({ prNumber = null, queryFn = null, databaseConfigured = null, limit: max = 10 } = {}) {
  const safePr = pr(prNumber);
  const safeLimit = limit(max);
  const databaseConfiguredSafe = db(databaseConfigured);
  const queryEvidence = safePr ? buildQueryEvidence(safePr) : buildQueryEvidence("unknown");

  if (!safePr) {
    return {
      ok: false,
      type: "project_memory_entry_lookup_check",
      version: PROJECT_MEMORY_ENTRY_LOOKUP_CHECK_VERSION,
      summary: "Project Memory entry lookup skipped: valid prNumber is required.",
      details: emptyDetails({ databaseConfigured: databaseConfiguredSafe, checked: false, prNumber: null, queryEvidence }),
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
      details: emptyDetails({ databaseConfigured: false, checked: false, prNumber: safePr, queryEvidence }),
      warnings: [warning("database_not_configured", "Project Memory entry lookup cannot verify live storage without database configuration.", safePr)],
      sanitized: true,
      readOnly: true,
    };
  }

  const exactResult = await readExact({ prNumber: safePr, queryFn, safeLimit });
  if (!exactResult.ok) {
    return {
      ok: false,
      type: "project_memory_entry_lookup_check",
      version: PROJECT_MEMORY_ENTRY_LOOKUP_CHECK_VERSION,
      summary: `Project Memory entry lookup for PR #${safePr} failed.`,
      details: emptyDetails({ databaseConfigured: true, checked: false, prNumber: safePr, queryEvidence }),
      warnings: [warning("project_memory_entry_lookup_query_failed", "Project Memory entry lookup query failed.", safePr)],
      sanitized: true,
      readOnly: true,
      reason: exactResult.reason || "project_memory_entry_lookup_query_failed",
    };
  }

  const nearResult = await readNear({ prNumber: safePr, queryFn, safeLimit });
  const exactMatches = (exactResult.rows || []).map(map);
  const exactIds = new Set(exactMatches.map((entry) => entry.id).filter(Boolean));
  const nearMatches = nearResult.ok
    ? (nearResult.rows || []).map(map).filter((entry) => !exactIds.has(entry.id))
    : [];
  const entries = exactMatches;
  const confirmedActiveFound = entries.some((entry) => entry.trust === "confirmed" && entry.status === "active");
  const warnings = [];

  if (!entries.length) warnings.push(warning("project_memory_entry_not_found", "No exact Project Memory entry matched this PR number.", safePr));
  if (entries.length && !confirmedActiveFound) warnings.push(warning("project_memory_entry_found_but_not_confirmed_active", "Entry exists, but no exact matched entry is confirmed and active.", safePr));
  if (!nearResult.ok) warnings.push(warning("project_memory_entry_near_match_query_failed", "Near-match Project Memory lookup query failed.", safePr));
  if (!entries.length && nearMatches.length) warnings.push(warning("project_memory_entry_near_matches_found", "No exact match was found, but near matches exist. Inspect storage shape before changing lookup logic.", safePr));

  return {
    ok: confirmedActiveFound,
    type: "project_memory_entry_lookup_check",
    version: PROJECT_MEMORY_ENTRY_LOOKUP_CHECK_VERSION,
    summary: entries.length
      ? `Project Memory entry lookup for PR #${safePr}: found=${entries.length}, confirmed_active=${confirmedActiveFound}, near_matches=${nearMatches.length}.`
      : `Project Memory entry lookup for PR #${safePr}: no exact entries found, near_matches=${nearMatches.length}.`,
    details: {
      databaseConfigured: true,
      checked: true,
      requestedPrNumber: safePr,
      prNumber: safePr,
      found: entries.length > 0,
      confirmedActiveFound,
      queryPatternsApplied: queryEvidence,
      exactMatches,
      nearMatches,
      entries,
    },
    warnings,
    sanitized: true,
    readOnly: true,
  };
}

export default { runProjectMemoryEntryLookupCheck };
