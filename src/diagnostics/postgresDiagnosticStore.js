import { randomUUID } from 'node:crypto';
import { createDiagnosticEvidence } from './contracts.js';

function required(value, name) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

export function createPostgresDiagnosticStore({ database } = {}) {
  if (!database?.query) throw new TypeError('database.query is required');

  return Object.freeze({
    async createRun({ runId = randomUUID(), mode, traceId = null, requestId = null, testCaseId = null, status = 'started', environment = null, revision = null, input = {} } = {}) {
      const result = await database.query(`INSERT INTO diagnostic_runs(run_id,mode,trace_id,request_id,test_case_id,status,environment,revision,input)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING *`, [runId, required(mode, 'mode'), traceId, requestId, testCaseId, status, environment, revision, JSON.stringify(input)]);
      return result.rows[0];
    },
    async completeRun({ runId, status, report }) {
      const result = await database.query(`UPDATE diagnostic_runs SET status=$2, report=$3::jsonb, completed_at=now() WHERE run_id=$1 RETURNING *`, [required(runId, 'runId'), required(status, 'status'), JSON.stringify(report ?? {})]);
      return result.rows[0] ?? null;
    },
    async addEvidence(runId, input) {
      const scopedRunId = required(runId, 'runId');
      const evidence = createDiagnosticEvidence(input);
      const result = await database.query(`INSERT INTO diagnostic_evidence(evidence_id,run_id,source,source_ref,occurred_at,trace_id,request_id,stage,status,component,error_code,fingerprint,payload)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
        ON CONFLICT(run_id,source,fingerprint) DO UPDATE SET source_ref=EXCLUDED.source_ref RETURNING *`, [
        evidence.evidenceId, scopedRunId, evidence.source, evidence.sourceRef, evidence.occurredAt, evidence.traceId, evidence.requestId,
        evidence.stage, evidence.status, evidence.component, evidence.errorCode, evidence.fingerprint, JSON.stringify(evidence.payload)
      ]);
      return evidenceFromRow(result.rows[0]);
    },
    async listEvidence({ runId = null, traceId = null, requestId = null, limit = 1000 } = {}) {
      const result = await database.query(`SELECT * FROM diagnostic_evidence WHERE ($1::text IS NULL OR run_id=$1)
        AND ($2::text IS NULL OR trace_id=$2) AND ($3::text IS NULL OR request_id=$3)
        ORDER BY occurred_at NULLS LAST, created_at, evidence_id LIMIT $4`, [runId, traceId, requestId, limit]);
      return result.rows.map(evidenceFromRow);
    },
    async saveFindings(runId, findings = []) {
      for (const finding of findings) {
        await database.query(`INSERT INTO diagnostic_findings(finding_id,run_id,kind,error_class,component,confidence,summary,evidence_ids,data)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)
          ON CONFLICT(finding_id) DO NOTHING`, [finding.findingId, required(runId, 'runId'), finding.kind, finding.errorClass, finding.component, finding.confidence, finding.summary, JSON.stringify(finding.evidenceIds), JSON.stringify(finding.data)]);
      }
    },
    async getRun(runId) {
      const result = await database.query('SELECT * FROM diagnostic_runs WHERE run_id=$1', [required(runId, 'runId')]);
      return result.rows[0] ?? null;
    },
    async listRuns({ limit = 50 } = {}) {
      const result = await database.query('SELECT * FROM diagnostic_runs ORDER BY created_at DESC LIMIT $1', [limit]);
      return result.rows;
    },
    async putRegression({ regressionId = randomUUID(), name, fixture, expected, fixedRevision = null, enabled = true } = {}) {
      const result = await database.query(`INSERT INTO diagnostic_regressions(regression_id,name,enabled,fixture,expected,fixed_revision)
        VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6)
        ON CONFLICT(regression_id) DO UPDATE SET name=EXCLUDED.name,enabled=EXCLUDED.enabled,fixture=EXCLUDED.fixture,expected=EXCLUDED.expected,fixed_revision=EXCLUDED.fixed_revision,updated_at=now() RETURNING *`, [regressionId, required(name, 'name'), enabled, JSON.stringify(fixture ?? {}), JSON.stringify(expected ?? {}), fixedRevision]);
      return result.rows[0];
    },
    async listRegressions({ enabledOnly = true } = {}) {
      const result = await database.query('SELECT * FROM diagnostic_regressions WHERE ($1::boolean=false OR enabled=true) ORDER BY created_at, regression_id', [enabledOnly]);
      return result.rows;
    },
    async recordAccess({ accessId = randomUUID(), actorGlobalUserId = null, method, path, outcome, reason = null } = {}) {
      const result = await database.query(`INSERT INTO diagnostic_access_audit(access_id,actor_global_user_id,method,path,outcome,reason)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [accessId, actorGlobalUserId, required(method, 'method'), required(path, 'path'), required(outcome, 'outcome'), reason]);
      return result.rows[0];
    },
    async listAccessAudit({ limit = 100 } = {}) {
      const result = await database.query('SELECT * FROM diagnostic_access_audit ORDER BY created_at DESC, access_id DESC LIMIT $1', [limit]);
      return result.rows;
    }
  });
}

function evidenceFromRow(row) {
  return createDiagnosticEvidence({
    evidenceId: row.evidence_id,
    source: row.source,
    sourceRef: row.source_ref,
    occurredAt: row.occurred_at?.toISOString?.() ?? row.occurred_at ?? null,
    traceId: row.trace_id,
    requestId: row.request_id,
    stage: row.stage,
    status: row.status,
    component: row.component,
    errorCode: row.error_code,
    fingerprint: row.fingerprint,
    payload: row.payload ?? {}
  });
}
