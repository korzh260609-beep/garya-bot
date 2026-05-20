// src/diagnostics/projectMemoryCountsCheck.js
// SG 2.0 — Project Memory counts diagnostics check.
// Purpose: read-only count of Project Memory entries by project/trust/status and write-audit activity.
// Do not add Telegram logic, AI calls, memory writes, schema creation, migrations, candidate confirmation, source sync, or raw secret output here.

import { isDatabaseConfigured, queryPostgres } from "../db/postgresClient.js";
import { PROJECT_MEMORY_TABLES } from "../memory/index.js";

export const PROJECT_MEMORY_COUNTS_CHECK_VERSION = 2;

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

function normalizeAuditRows(rows = []) {
  return Array.isArray(rows)
    ? rows.map((row) => ({
        action: row.action || "",
        decision: row.decision || "",
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

function buildWarnings({ databaseConfigured, queryOk, sgConfirmedActiveCount, totalEntries = 0, writeAuditTotal = 0 } = {}) {
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

  if (safeNumber(totalEntries) === 0 && safeNumber(writeAuditTotal) === 0) {
    warnings.push({
      code: "project_memory_no_durable_write_activity",
      message: "No Project Memory entries and no Project Memory write-audit records were found; durable write pipeline has not recorded activity in this DB.",
    });
  }

  if (safeNumber(totalEntries) === 0 && safeNumber(writeAuditTotal) > 0) {
    warnings.push({
      code: "project_memory_audit_exists_but_entries_empty",
      message: "Project Memory write-audit records exist, but entries are empty; inspect candidate creation and confirmation decisions.",
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

async function readWriteAuditCounts({ queryFn = null } = {}) {
  const runQuery = normalizeQueryFn(queryFn);

  return runQuery(
    `SELECT action, decision, COUNT(*)::int AS count
     FROM ${PROJECT_MEMORY_TABLES.WRITE_AUDIT}
     GROUP BY action, decision
     ORDER BY action ASC, decision ASC`,
  );
}

function buildEmptyDetails({ databaseConfigured = false, checked = false } = {}) {
  return {
    databaseConfigured,
    checked,
    totalEntries: 0,
    sgConfirmedActiveCount: 0,
    sgPendingCandidateCount: 0,
    groupedCounts: [],
    writeAuditTotal: 0,
    groupedWriteAuditCounts: [],
  };
}

export async function runProjectMemoryCountsCheck({ queryFn = null, databaseConfigured = null } = {}) {
  const dbConfigured = resolveDatabaseConfigured(databaseConfigured);

  if (!dbConfigured) {
    return {
      ok: false,
      type: "project_memory_counts_check",
      version: PROJECT_MEMORY_COUNTS_CHECK_VERSION,
      summary: "Project Memory counts check skipped: DATABASE_URL is not configured.",
      details: buildEmptyDetails({ databaseConfigured: false, checked: false }),
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
      details: buildEmptyDetails({ databaseConfigured: true, checked: false }),
      warnings: buildWarnings({ databaseConfigured: true, queryOk: false }),
      sanitized: true,
      readOnly: true,
      reason: result.reason || "project_memory_counts_query_failed",
    };
  }

  const auditResult = await readWriteAuditCounts({ queryFn });

  if (!auditResult.ok) {
    return {
      ok: false,
      type: "project_memory_counts_check",
      version: PROJECT_MEMORY_COUNTS_CHECK_VERSION,
      summary: "Project Memory write-audit counts query failed.",
      details: buildEmptyDetails({ databaseConfigured: true, checked: false }),
      warnings: buildWarnings({ databaseConfigured: true, queryOk: false }),
      sanitized: true,
      readOnly: true,
      reason: auditResult.reason || "project_memory_write_audit_counts_query_failed",
    };
  }

  const groupedCounts = normalizeRows(result.rows);
  const groupedWriteAuditCounts = normalizeAuditRows(auditResult.rows);
  const totalEntries = sumRows(groupedCounts);
  const writeAuditTotal = sumRows(groupedWriteAuditCounts);
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
    totalEntries,
    writeAuditTotal,
  });

  return {
    ok: result.ok && auditResult.ok,
    type: "project_memory_counts_check",
    version: PROJECT_MEMORY_COUNTS_CHECK_VERSION,
    summary: `Project Memory counts checked: total=${totalEntries}, sg_confirmed_active=${sgConfirmedActiveCount}, write_audit_total=${writeAuditTotal}.`,
    details: {
      databaseConfigured: true,
      checked: true,
      totalEntries,
      sgConfirmedActiveCount,
      sgPendingCandidateCount,
      groupedCounts,
      writeAuditTotal,
      groupedWriteAuditCounts,
    },
    warnings,
    sanitized: true,
    readOnly: true,
  };
}

export default {
  runProjectMemoryCountsCheck,
};
