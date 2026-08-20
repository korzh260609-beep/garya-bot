import {
  createDevelopmentEvent,
  createDevelopmentEventProjectFactCandidate,
  createDevelopmentSourceIdentity
} from '../projectDevelopmentKnowledge/index.js';

export const GH3_TRUSTED_EVIDENCE_INTEGRATION_CONTRACT_VERSION = 1;

const OUTCOME_TYPES = Object.freeze(['commit', 'pull-request', 'workflow']);

function fail(code, message) { const error = new Error(message); error.name = 'GitHubTrustedDevelopmentEvidenceError'; error.code = code; throw error; }
function required(value, field) { if (typeof value !== 'string' || value.trim() === '') fail('gh3-evidence-input-invalid', `${field} is required`); return value.trim(); }
function fullSha(value, field = 'sha') { const text = required(value, field).toLowerCase(); if (!/^[a-f0-9]{40}$/.test(text)) fail('gh3-evidence-input-invalid', `${field} must be a full immutable git SHA`); return text; }
function iso(value, field) { const text = required(value, field); if (Number.isNaN(Date.parse(text))) fail('gh3-evidence-input-invalid', `${field} must be an ISO timestamp`); return new Date(text).toISOString(); }
function positiveInteger(value, field) { const number = Number(value); if (!Number.isInteger(number) || number < 1) fail('gh3-evidence-input-invalid', `${field} must be a positive integer`); return number; }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }

function normalizeOutcome(input = {}) {
  const type = required(input.type, 'outcome.type').toLowerCase();
  if (!OUTCOME_TYPES.includes(type)) fail('gh3-evidence-outcome-unsupported', `unsupported GitHub outcome type: ${type}`);
  const projectKey = required(input.projectKey, 'outcome.projectKey').toLowerCase();
  const repository = required(input.repository, 'outcome.repository').toLowerCase();
  const headSha = fullSha(input.headSha, 'outcome.headSha');
  const occurredAt = iso(input.occurredAt, 'outcome.occurredAt');
  if (input.modelGenerated === true || input.selfConfirmed === true || input.confirmed === true) fail('gh3-evidence-self-confirmation-denied', 'GitHub outcomes cannot self-confirm PDK4/PM3 truth');
  if (['deployed', 'live-verified'].includes(input.claimedState)) fail('gh3-evidence-state-promotion-denied', 'repository or CI evidence cannot claim deployed or live-verified state');
  if (type === 'workflow') {
    const conclusion = required(input.conclusion, 'outcome.conclusion').toLowerCase();
    if (conclusion !== 'success') fail('gh3-evidence-ci-not-verified', 'only a successful exact-head workflow is CI verification evidence');
    const targetSha = fullSha(input.targetSha, 'outcome.targetSha');
    if (targetSha !== headSha) fail('gh3-evidence-exact-head-mismatch', 'workflow target does not match the verified exact HEAD');
    return freeze({ ...input, type, projectKey, repository, headSha, targetSha, occurredAt, conclusion, runId: positiveInteger(input.runId, 'outcome.runId'), attempt: positiveInteger(input.attempt ?? 1, 'outcome.attempt') });
  }
  if (type === 'pull-request') return freeze({ ...input, type, projectKey, repository, headSha, occurredAt, number: positiveInteger(input.number, 'outcome.number') });
  return freeze({ ...input, type, projectKey, repository, headSha, occurredAt });
}

function sourceFor(outcome) {
  if (outcome.type === 'workflow') return createDevelopmentSourceIdentity({ kind: 'github-workflow', projectKey: outcome.projectKey, repository: outcome.repository, runId: outcome.runId, attempt: outcome.attempt });
  if (outcome.type === 'pull-request') return createDevelopmentSourceIdentity({ kind: 'github-pr', projectKey: outcome.projectKey, repository: outcome.repository, number: outcome.number, headSha: outcome.headSha });
  return createDevelopmentSourceIdentity({ kind: 'github-commit', projectKey: outcome.projectKey, repository: outcome.repository, sha: outcome.headSha });
}

function eventInput(outcome, source, traceId) {
  const common = {
    projectKey: outcome.projectKey,
    domain: outcome.domain ?? 'architecture',
    component: required(outcome.component, 'outcome.component'),
    title: required(outcome.title, 'outcome.title'),
    summary: required(outcome.summary, 'outcome.summary'),
    occurredAt: outcome.occurredAt,
    provenance: [source],
    traceId,
    confidence: 1,
    result: { repository: outcome.repository, headSha: outcome.headSha }
  };
  if (outcome.type === 'workflow') return { ...common, eventType: 'ci-verification', previousState: 'implemented', newState: 'ci-verified', verification: [{ kind: 'ci', projectKey: outcome.projectKey, sourceId: source.sourceId, ref: `github-workflow:${outcome.runId}:attempt:${outcome.attempt}`, verifiedAt: outcome.occurredAt }] };
  if (outcome.type === 'pull-request') return { ...common, eventType: 'implementation', previousState: 'implementing', newState: 'implemented', verification: [{ kind: 'code', projectKey: outcome.projectKey, sourceId: source.sourceId, ref: `github-pr:${outcome.number}`, verifiedAt: outcome.occurredAt }] };
  return { ...common, eventType: 'implementation', previousState: 'implementing', newState: 'implemented', verification: [{ kind: 'code', projectKey: outcome.projectKey, sourceId: source.sourceId, ref: `github-commit:${outcome.headSha}`, verifiedAt: outcome.occurredAt }] };
}

export function createGitHubTrustedDevelopmentEvidenceIntegration({ projectMemoryStore, developmentEventSink = null, clock = () => new Date() } = {}) {
  if (typeof projectMemoryStore?.put !== 'function') throw new TypeError('projectMemoryStore.put is required');
  if (developmentEventSink && typeof developmentEventSink.ingest !== 'function') throw new TypeError('developmentEventSink.ingest must be a function');
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');

  async function ingestVerifiedOutcome(input = {}) {
    const outcome = normalizeOutcome(input);
    const traceId = required(input.traceId, 'outcome.traceId');
    const source = sourceFor(outcome);
    const event = createDevelopmentEvent(eventInput(outcome, source, traceId), { clock });
    const candidate = createDevelopmentEventProjectFactCandidate(event, { trust: 'verified', confirmed: false, confirmationState: 'proposed' });
    if (candidate.confirmed !== false || candidate.confirmationState !== 'proposed' || candidate.trust === 'confirmed') fail('gh3-evidence-pm3-promotion-denied', 'GH3 evidence must remain an unconfirmed PM3 candidate');
    const acceptedEvent = developmentEventSink ? await developmentEventSink.ingest(event) : event;
    if (!acceptedEvent || acceptedEvent.projectKey !== outcome.projectKey || acceptedEvent.eventId !== event.eventId) fail('gh3-evidence-pdk4-ingestion-mismatch', 'PDK4 ingestion result does not match normalized evidence');
    const stored = await projectMemoryStore.put(candidate);
    if (!stored || stored.projectKey !== outcome.projectKey || stored.confirmed !== false || stored.confirmationState !== 'proposed' || stored.trust === 'confirmed') fail('gh3-evidence-pm3-promotion-denied', 'PM3 store attempted to promote GH3 evidence');
    return freeze({ contractVersion: GH3_TRUSTED_EVIDENCE_INTEGRATION_CONTRACT_VERSION, status: 'ingested', outcomeType: outcome.type, projectKey: outcome.projectKey, repository: outcome.repository, headSha: outcome.headSha, developmentEvent: acceptedEvent, projectMemoryCandidate: stored, deployed: false, liveVerified: false });
  }

  return Object.freeze({ ingestVerifiedOutcome });
}
