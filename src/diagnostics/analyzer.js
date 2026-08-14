import { createDiagnosticFinding } from './contracts.js';
import { eventNames } from './pathRegistry.js';

const CLASS_BY_STAGE = Object.freeze({
  'transport.receive': 'TRANSPORT', identity: 'IDENTITY', scope: 'SCOPE', context: 'CONTEXT', memory: 'MEMORY', semantic: 'SEMANTIC',
  'action-gate': 'ACTION_GATE', capability: 'CAPABILITY', ai: 'AI_ROUTER', 'ai-provider': 'AI_PROVIDER', response: 'RESPONSE',
  delivery: 'DELIVERY', persistence: 'PERSISTENCE', 'worker.claim': 'WORKER'
});

function matches(evidence, aliases) {
  const wanted = new Set(aliases);
  return eventNames(evidence).some((name) => wanted.has(name));
}

function failureLike(evidence) {
  if (['failed', 'timeout'].includes(evidence.status)) return true;
  const outcome = String(evidence.payload?.outcome ?? evidence.payload?.data?.outcome ?? '').toLowerCase();
  return ['failed', 'failure', 'timeout', 'error', 'denied'].includes(outcome);
}

function successfulLike(evidence) {
  if (evidence.status === 'completed') return true;
  const outcome = String(evidence.payload?.outcome ?? '').toLowerCase();
  return ['completed', 'success', 'succeeded', 'ok', 'delivered', 'allow', 'allowed'].includes(outcome);
}

function failureCode(evidence) {
  return evidence.errorCode ?? evidence.payload?.data?.code ?? evidence.payload?.data?.error?.code ?? evidence.payload?.code ?? null;
}

function classifyFailure(stage, evidence) {
  const code = String(failureCode(evidence) ?? '').toLowerCase();
  if (code.includes('provider') || code.includes('openai')) return 'AI_PROVIDER';
  if (code.includes('database') || code.includes('postgres') || code.includes('migration')) return 'PERSISTENCE';
  if (code.includes('delivery') || code.includes('telegram-send')) return 'DELIVERY';
  if (code.includes('response') || code.includes('echo')) return 'RESPONSE';
  if (code.includes('identity')) return 'IDENTITY';
  if (code.includes('scope')) return 'SCOPE';
  if (code.includes('permission') || code.includes('authorization') || code.includes('owner')) return 'AUTHORIZATION';
  if (code.includes('security')) return 'SECURITY';
  return CLASS_BY_STAGE[stage] ?? 'UNKNOWN';
}

function stageActual(pathStage, evidence) {
  const relevant = evidence.filter((item) => matches(item, pathStage[1]));
  if (relevant.length === 0) return { status: 'missing', evidence: [] };
  const failed = relevant.find(failureLike);
  if (failed) return { status: failed.status === 'timeout' || String(failureCode(failed) ?? '').includes('timeout') ? 'timeout' : 'failed', evidence: relevant, primary: failed };
  if (relevant.some(successfulLike)) return { status: 'completed', evidence: relevant, primary: relevant.at(-1) };
  return { status: 'degraded', evidence: relevant, primary: relevant.at(-1) };
}

export function reconstructTrace({ expectedPath, evidence = [] } = {}) {
  if (!expectedPath?.stages) throw new TypeError('expectedPath is required');
  const ordered = [...evidence].sort((a, b) => String(a.occurredAt ?? '').localeCompare(String(b.occurredAt ?? '')) || a.evidenceId.localeCompare(b.evidenceId));
  const stages = expectedPath.stages.map(([stage, aliases]) => Object.freeze({ stage, aliases, ...stageActual([stage, aliases], ordered) }));
  return Object.freeze({ expectedPathId: expectedPath.id, evidence: Object.freeze(ordered), stages: Object.freeze(stages) });
}

export function findFirstDivergence(trace) {
  const stages = trace?.stages ?? [];
  for (let index = 0; index < stages.length; index += 1) {
    const current = stages[index];
    if (current.status === 'completed') continue;
    if (current.stage === 'ai' && current.status === 'missing') {
      const capability = stages.find((item) => item.stage === 'capability');
      if (capability?.status === 'completed') continue;
    }
    const previousCompleted = stages.slice(0, index).every((item) => item.status === 'completed' || (item.stage === 'ai' && item.status === 'missing'));
    return Object.freeze({ index, stage: current.stage, status: current.status, evidenceIds: Object.freeze(current.evidence.map((item) => item.evidenceId)), previousCompleted });
  }
  return null;
}

export function isTraceInFlight(trace, firstDivergence, { nowMs = Date.now(), graceMs = 300000 } = {}) {
  if (!firstDivergence || !trace?.evidence?.length) return false;
  if (trace.evidence.some(failureLike)) return false;
  const lastTimestamp = Math.max(...trace.evidence.map((item) => Date.parse(item.occurredAt ?? '')).filter(Number.isFinite));
  if (!Number.isFinite(lastTimestamp)) return false;
  return nowMs - lastTimestamp >= 0 && nowMs - lastTimestamp <= Math.max(0, Number(graceMs));
}

function gateDeniedIsExpected(stage, evidence) {
  if (stage !== 'action-gate') return false;
  return evidence.some((item) => ['deny', 'denied', 'confirmation-required', 'downgrade'].includes(String(item.payload?.outcome ?? item.payload?.data?.gateOutcome ?? '').toLowerCase()));
}

export function analyzeRootCause({ trace, firstDivergence, deploymentFindings = [] } = {}) {
  const deploymentConfirmed = deploymentFindings.find((finding) => finding.kind === 'deployment-mismatch' && finding.confidence === 'CONFIRMED');
  if (deploymentConfirmed) return Object.freeze({ errorClass: 'DEPLOYMENT', component: deploymentConfirmed.component, confidence: 'CONFIRMED', summary: deploymentConfirmed.summary, evidenceIds: deploymentConfirmed.evidenceIds ?? [], data: deploymentConfirmed.data ?? {} });
  if (!firstDivergence) return null;
  const stage = trace.stages[firstDivergence.index];
  if (gateDeniedIsExpected(stage.stage, stage.evidence)) return Object.freeze({ errorClass: 'ACTION_GATE', component: 'action-gate', confidence: 'CONFIRMED', summary: 'Action Gate stopped the request according to an explicit gate outcome.', evidenceIds: stage.evidence.map((item) => item.evidenceId), data: { expectedControlOutcome: true } });
  const primary = stage.primary;
  if (primary) {
    const errorClass = classifyFailure(stage.stage, primary);
    return Object.freeze({ errorClass, component: primary.component ?? stage.stage, confidence: failureCode(primary) ? 'CONFIRMED' : 'HIGH', summary: `${stage.stage} ${stage.status}${failureCode(primary) ? `: ${failureCode(primary)}` : ''}`, evidenceIds: stage.evidence.map((item) => item.evidenceId), data: { stage: stage.stage, status: stage.status, errorCode: failureCode(primary) } });
  }
  const childFailure = trace.evidence.find((item) => failureLike(item));
  if (childFailure) return Object.freeze({ errorClass: classifyFailure(stage.stage, childFailure), component: childFailure.component ?? stage.stage, confidence: 'MEDIUM', summary: `Expected stage ${stage.stage} is missing; a correlated failure exists in the trace.`, evidenceIds: [childFailure.evidenceId], data: { missingStage: stage.stage, correlatedErrorCode: failureCode(childFailure) } });
  return Object.freeze({ errorClass: CLASS_BY_STAGE[stage.stage] ?? 'UNKNOWN', component: stage.stage, confidence: 'LOW', summary: `Expected stage ${stage.stage} has no matching completion evidence.`, evidenceIds: [], data: { missingStage: stage.stage } });
}

export function buildFindings({ trace, firstDivergence, rootCause, deploymentFindings = [] } = {}) {
  const findings = [...deploymentFindings];
  if (firstDivergence) findings.push(createDiagnosticFinding({ kind: 'first-divergence', errorClass: rootCause?.errorClass ?? CLASS_BY_STAGE[firstDivergence.stage] ?? 'UNKNOWN', component: firstDivergence.stage, confidence: firstDivergence.evidenceIds.length ? 'HIGH' : 'MEDIUM', summary: `First divergence at ${firstDivergence.stage}: ${firstDivergence.status}.`, evidenceIds: firstDivergence.evidenceIds, data: { expectedPathId: trace.expectedPathId, index: firstDivergence.index } }));
  if (rootCause) findings.push(createDiagnosticFinding({ kind: 'root-cause', errorClass: rootCause.errorClass, component: rootCause.component, confidence: rootCause.confidence, summary: rootCause.summary, evidenceIds: rootCause.evidenceIds, data: rootCause.data }));
  return Object.freeze(findings);
}

export function downstreamEffects(trace, firstDivergence) {
  if (!firstDivergence) return Object.freeze([]);
  return Object.freeze(trace.stages.slice(firstDivergence.index + 1).filter((item) => item.status !== 'completed').map((item) => Object.freeze({ stage: item.stage, status: item.status })));
}
