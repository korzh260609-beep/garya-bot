import { randomUUID } from 'node:crypto';
import {
  PROJECT_MEMORY3_DIAGNOSTICS_CONTRACT_VERSION,
  PROJECT_MEMORY3_DIAGNOSTIC_CHECKS,
  createProjectMemoryDiagnostics as createCoreProjectMemoryDiagnostics
} from './diagnosticsObservability.js';

const BLOCKED_KEYS = new Set(['fact', 'factData', 'payload', 'sourceRef', 'sourcePayload', 'rawMemory', 'rawValue']);

function sanitizeCode(value) {
  const text = String(value ?? 'project-memory-diagnostic-failed').slice(0, 128);
  return /^[a-z0-9._:-]+$/i.test(text) ? text : 'project-memory-diagnostic-failed';
}

function sanitize(value, key = '') {
  if (BLOCKED_KEYS.has(key)) return undefined;
  if (Array.isArray(value)) return Object.freeze(value.map((item) => sanitize(item)).filter((item) => item !== undefined));
  if (!value || typeof value !== 'object') {
    if (key === 'message') return 'Project Memory diagnostic check failed.';
    if (key === 'code') return sanitizeCode(value);
    return value;
  }
  const output = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    const sanitized = sanitize(childValue, childKey);
    if (sanitized !== undefined) output[childKey] = sanitized;
  }
  return Object.freeze(output);
}

async function recordBoundedAccessAudit(database, projectKey, report) {
  const selected = await database.query(`SELECT e.memory_id,e.trace_id,e.source_event_id,e.record_version,m.lifecycle_state
    FROM project_memory_entries e JOIN memory_records m USING(memory_id)
    WHERE e.project_key=$1 ORDER BY e.updated_at DESC,e.memory_id LIMIT 1`, [projectKey]);
  const row = selected.rows[0];
  if (!row) return Object.freeze({ recorded: false, reason: 'no-project-memory-records' });
  const search = report.checks?.find((item) => item.check === 'project_memory_search_test');
  const now = report.generatedAt ?? new Date().toISOString();
  const events = [
    {
      type: 'read-audit',
      snapshot: { operation: 'read', bounded: true, rawMemoryIncluded: false, diagnosticContractVersion: PROJECT_MEMORY3_DIAGNOSTICS_CONTRACT_VERSION }
    },
    {
      type: 'retrieval-audit',
      snapshot: {
        operation: 'retrieval', bounded: true, rawMemoryIncluded: false,
        resultCount: Number(search?.data?.resultCount ?? 0),
        semanticMode: String(search?.data?.semanticMode ?? 'none').slice(0, 64),
        diagnosticContractVersion: PROJECT_MEMORY3_DIAGNOSTICS_CONTRACT_VERSION
      }
    }
  ];
  for (const event of events) {
    await database.query(`INSERT INTO project_memory_history(history_id,memory_id,project_key,event_type,lifecycle_state,record_version,trace_id,source_event_id,snapshot,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`, [
      randomUUID(), row.memory_id, projectKey, event.type, row.lifecycle_state, row.record_version,
      row.trace_id, row.source_event_id, JSON.stringify(event.snapshot), now
    ]);
  }
  return Object.freeze({ recorded: true, events: Object.freeze(events.map((event) => event.type)) });
}

function wrapResult(value) {
  return sanitize(value);
}

export function createProjectMemoryDiagnostics(options = {}) {
  const core = createCoreProjectMemoryDiagnostics(options);
  const database = options.database;

  async function runAll(input = {}) {
    const report = await core.runAll(input);
    const sanitizedReport = wrapResult(report);
    const projectKey = sanitizedReport.projectKey;
    let accessAudit;
    try {
      accessAudit = await recordBoundedAccessAudit(database, projectKey, sanitizedReport);
    } catch {
      accessAudit = Object.freeze({ recorded: false, reason: 'audit-write-unavailable' });
    }
    return Object.freeze({
      ...sanitizedReport,
      auditCoverage: Object.freeze({
        write: 'project_memory_history:stored',
        read: 'project_memory_history:read-audit',
        retrieval: 'project_memory_history:retrieval-audit',
        supersession: 'project_memory_history:superseded',
        conflict: 'project_memory_conflicts',
        accessAudit
      })
    });
  }

  return Object.freeze({
    health: async (input) => wrapResult(await core.health(input)),
    counts: async (input) => wrapResult(await core.counts(input)),
    searchTest: async (input) => wrapResult(await core.searchTest(input)),
    duplicateTest: async (input) => wrapResult(await core.duplicateTest(input)),
    conflictTest: async (input) => wrapResult(await core.conflictTest(input)),
    sourceTest: async (input) => wrapResult(await core.sourceTest(input)),
    contextTest: async (input) => wrapResult(await core.contextTest(input)),
    restartContinuityTest: async (input) => wrapResult(await core.restartContinuityTest(input)),
    auditMetadata: async (input) => wrapResult(await core.auditMetadata(input)),
    runAll
  });
}

export {
  PROJECT_MEMORY3_DIAGNOSTICS_CONTRACT_VERSION,
  PROJECT_MEMORY3_DIAGNOSTIC_CHECKS
};
