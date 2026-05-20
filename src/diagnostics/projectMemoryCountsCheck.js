// src/diagnostics/projectMemoryCountsCheck.js
// SG 2.0 — Project Memory counts diagnostics check.
// Purpose: read-only count of Project Memory entries by project/trust/status.
// Do not add Telegram logic, AI calls, memory writes, schema creation, migrations, candidate confirmation, source sync, or raw secret output here.

import { isDatabaseConfigured, queryPostgres } from "../db/postgresClient.js";
import { PROJECT_MEMORY_TABLES } from "../memory/index.js";

export const PROJECT_MEMORY_COUNTS_CHECK_VERSION = 1;

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeRows(rows = []) {
  return Array.isArray(rows)
    ? rows.map((row) => ({
        projectKey: row.project_key || "",
        trust: row.trust || "",
        status: row.status || "",
        count: safeNumber(row.count),
      }))
    : [];
}

function sumRows(rows = []) {
  return rows.reduce((sum, row) => sum + safeNumber(row.count), 0);
}

function findCount(rows = [], { projectKey = "sg", trust = "confirmed", status = "active" } = {}) {
  return rows
    .filter((row) => row.projectKey === projectKey && row.trust === trust && row.status === status)
    .reduce((sum, row) => sum + safeNumber(row.count), 0);
}

function normalizeQueryFn(queryFn) {
  return typeof queryFn === "function" ? queryFn : queryPostgres;
}

function resolveDatabaseConfigured(value) {
  if (typeof value === "boolean") return value;
  return isDatabaseConfigured();
}

function buildWarnings({ databaseConfigured, queryOk, sgConfirmedActiveCount } = {}) {
  const warnings = [];

  if (!databaseConfigured) {
    warnings.push({
      code: "database_not_configured",
      message: "DATABASE_URL is not configured; Project Memory counts cannot be verified.",
    });
    return warnings;
  }

  if (!queryOk) {
    warnings.push({
      code: "project_memory_counts_query_failed",
      message: "Project Memory counts query failed.",
    });
    return warnings;
  }

  if (safeNumber(sgConfirmedActiveCount) === 0) {
    warnings.push({
      code: "project_memory_sg_confirmed_active_empty",
      message: "No confirmed active Project Memory entries found for project_key=sg.",
    });
  }

  return warnings;
}

async function readCounts({ queryFn = null } = {}) {
  const runQuery = normalizeQueryFn(queryFn);

  return runQuery(
    `SELECT project_key, trust, status, COUNT(*)::int AS count
     FROM ${PROJECT_MEMORY_TABLES.ENTRIES}
     GROUP BY project_key, trust, status
     ORDER BY project_key ASC, trust ASC, status ASC`,
  );
}

export async function runProjectMemoryCountsCheck({ queryFn = null, databaseConfigured = null } = {}) {
  const dbConfigured = resolveDatabaseConfigured(databaseConfigured);

  if (!dbConfigured) {
    return {
      ok: false,
      type: "project_memory_counts_check",
      version: PROJECT_MEMORY_COUNTS_CHECK_VERSION,
      summary: "Project Memory counts check skipped: DATABASE_URL is not configured.",
      details: {
        databaseConfigured: false,
        checked: false,
        totalEntries: 0,
        sgConfirmedActiveCount: 0,
        sgPendingCandidateCount: 0,
        groupedCounts: [],
      },
      warnings: buildWarnings({ databaseConfigured: false }),
      sanitized: true,
      readOnly: true,
    };
  }

  const result = await readCounts({ queryFn });

  if (!result.ok) {
    return {
      ok: false,
      type: "project_memory_counts_check",
      version: PROJECT_MEMORY_COUNTS_CHECK_VERSION,
      summary: "Project Memory counts query failed.",
      details: {
        databaseConfigured: true,
        checked: false,
        totalEntries: 0,
        sgConfirmedActiveCount: 0,
        sgPendingCandidateCount: 0,
        groupedCounts: [],
      },
      warnings: buildWarnings({ databaseConfigured: true, queryOk: false }),
      sanitized: true,
      readOnly: true,
      reason: result.reason || "project_memory_counts_query_failed",
    };
  }

  const groupedCounts = normalizeRows(result.rows);
  const totalEntries = sumRows(groupedCounts);
  const sgConfirmedActiveCount = findCount(groupedCounts, {
    projectKey: "sg",
    trust: "confirmed",
    status: "active",
  });
  const sgPendingCandidateCount = findCount(groupedCounts, {
    projectKey: "sg",
    trust: "candidate",
    status: "pending_confirmation",
  });
  const warnings = buildWarnings({
    databaseConfigured: true,
    queryOk: true,
    sgConfirmedActiveCount,
  });

  return {
    ok: result.ok,
    type: "project_memory_counts_check",
    version: PROJECT_MEMORY_COUNTS_CHECK_VERSION,
    summary: `Project Memory counts checked: total=${totalEntries}, sg_confirmed_active=${sgConfirmedActiveCount}.`,
    details: {
      databaseConfigured: true,
      checked: true,
      totalEntries,
      sgConfirmedActiveCount,
      sgPendingCandidateCount,
      groupedCounts,
    },
    warnings,
    sanitized: true,
    readOnly: true,
  };
}

export default {
  runProjectMemoryCountsCheck,
};
