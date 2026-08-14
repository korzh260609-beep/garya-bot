import { createHash, randomUUID } from 'node:crypto';
import { redactSensitiveData } from '../secrets/redaction.js';

export const DIAGNOSTIC_VERSION = '1.0.0';
export const DIAGNOSTIC_STATUSES = Object.freeze(['started', 'completed', 'failed', 'timeout', 'skipped', 'missing', 'degraded', 'unknown']);
export const DIAGNOSTIC_CONFIDENCE = Object.freeze(['CONFIRMED', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']);
export const DIAGNOSTIC_ERROR_CLASSES = Object.freeze([
  'DEPLOYMENT', 'CONFIGURATION', 'TRANSPORT', 'IDENTITY', 'AUTHORIZATION', 'SCOPE', 'CONTEXT', 'MEMORY',
  'SEMANTIC', 'ACTION_GATE', 'CAPABILITY', 'AI_ROUTER', 'AI_PROVIDER', 'SOURCE', 'PERSISTENCE', 'WORKER',
  'RESPONSE', 'DELIVERY', 'SECURITY', 'UNKNOWN'
]);

function text(value, name, { required = false } = {}) {
  const normalized = value == null ? '' : String(value).trim();
  if (required && !normalized) throw new TypeError(`${name} is required`);
  return normalized || null;
}

function enumValue(value, allowed, name, fallback = null) {
  const normalized = text(value, name);
  if (!normalized) return fallback;
  if (!allowed.includes(normalized)) throw new TypeError(`${name} is invalid`);
  return normalized;
}

export function fingerprintDiagnosticEvidence(input = {}) {
  const stable = JSON.stringify({
    source: input.source ?? null,
    sourceRef: input.sourceRef ?? null,
    traceId: input.traceId ?? null,
    requestId: input.requestId ?? null,
    occurredAt: input.occurredAt ?? null,
    stage: input.stage ?? null,
    status: input.status ?? null,
    component: input.component ?? null,
    errorCode: input.errorCode ?? null,
    payload: redactSensitiveData(input.payload ?? {})
  });
  return createHash('sha256').update(stable).digest('hex');
}

export function createDiagnosticEvidence(input = {}) {
  const source = text(input.source, 'source', { required: true });
  const status = enumValue(input.status ?? 'unknown', DIAGNOSTIC_STATUSES, 'status', 'unknown');
  const payload = Object.freeze(redactSensitiveData(input.payload ?? {}));
  const evidence = {
    version: DIAGNOSTIC_VERSION,
    evidenceId: text(input.evidenceId, 'evidenceId') ?? randomUUID(),
    source,
    sourceRef: text(input.sourceRef, 'sourceRef'),
    occurredAt: text(input.occurredAt, 'occurredAt'),
    traceId: text(input.traceId, 'traceId'),
    requestId: text(input.requestId, 'requestId'),
    stage: text(input.stage, 'stage'),
    status,
    component: text(input.component, 'component'),
    errorCode: text(input.errorCode, 'errorCode'),
    payload
  };
  return Object.freeze({ ...evidence, fingerprint: input.fingerprint ?? fingerprintDiagnosticEvidence(evidence) });
}

export function createDiagnosticFinding(input = {}) {
  return Object.freeze({
    version: DIAGNOSTIC_VERSION,
    findingId: text(input.findingId, 'findingId') ?? randomUUID(),
    kind: text(input.kind, 'kind', { required: true }),
    errorClass: enumValue(input.errorClass ?? 'UNKNOWN', DIAGNOSTIC_ERROR_CLASSES, 'errorClass', 'UNKNOWN'),
    component: text(input.component, 'component'),
    confidence: enumValue(input.confidence ?? 'UNKNOWN', DIAGNOSTIC_CONFIDENCE, 'confidence', 'UNKNOWN'),
    summary: text(input.summary, 'summary', { required: true }),
    evidenceIds: Object.freeze([...(input.evidenceIds ?? [])].map(String)),
    data: Object.freeze(redactSensitiveData(input.data ?? {}))
  });
}

export function createDiagnosticReport(input = {}) {
  const findings = Object.freeze([...(input.findings ?? [])]);
  return Object.freeze({
    version: DIAGNOSTIC_VERSION,
    runId: text(input.runId, 'runId', { required: true }),
    mode: text(input.mode, 'mode', { required: true }),
    status: text(input.status, 'status', { required: true }),
    traceId: text(input.traceId, 'traceId'),
    requestId: text(input.requestId, 'requestId'),
    environment: text(input.environment, 'environment'),
    revision: text(input.revision, 'revision'),
    expectedPathId: text(input.expectedPathId, 'expectedPathId'),
    firstDivergence: input.firstDivergence ?? null,
    rootCause: input.rootCause ?? null,
    downstreamEffects: Object.freeze([...(input.downstreamEffects ?? [])]),
    findings,
    evidenceCount: Number(input.evidenceCount ?? 0),
    unknowns: Object.freeze([...(input.unknowns ?? [])]),
    generatedAt: input.generatedAt ?? new Date().toISOString()
  });
}
