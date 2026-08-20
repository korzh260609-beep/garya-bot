import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubTrustedDevelopmentEvidenceIntegration } from '../src/githubDevelopment/githubTrustedDevelopmentEvidenceIntegration.js';

const SHA = 'a'.repeat(40);
const OTHER_SHA = 'b'.repeat(40);
const CLOCK = () => new Date('2026-08-20T10:00:00.000Z');

function base(overrides = {}) { return { type: 'commit', projectKey: 'sg2.1', repository: 'korzh260609-beep/garya-bot', headSha: SHA, occurredAt: '2026-08-20T09:59:00.000Z', domain: 'architecture', component: 'GH3.10', title: 'Implement trusted evidence integration', summary: 'Normalizes verified GitHub outcomes through PDK4 and PM3 contracts.', traceId: 'trace-gh310', ...overrides }; }
function harness({ mutateStored = null } = {}) { const calls = []; const service = createGitHubTrustedDevelopmentEvidenceIntegration({ clock: CLOCK, developmentEventSink: { async ingest(event) { calls.push(['event', event]); return event; } }, projectMemoryStore: { async put(candidate) { calls.push(['candidate', candidate]); return mutateStored ? mutateStored(candidate) : candidate; } } }); return { service, calls }; }

test('GH3.10: verified commit becomes one PDK4 event and one proposed PM3 candidate', async () => {
  const { service, calls } = harness();
  const result = await service.ingestVerifiedOutcome(base());
  assert.equal(result.developmentEvent.eventType, 'implementation');
  assert.equal(result.developmentEvent.newState, 'implemented');
  assert.equal(result.developmentEvent.provenance[0].kind, 'github-commit');
  assert.equal(result.projectMemoryCandidate.layer, 'project-memory');
  assert.equal(result.projectMemoryCandidate.confirmed, false);
  assert.equal(result.projectMemoryCandidate.confirmationState, 'proposed');
  assert.equal(result.projectMemoryCandidate.trust, 'verified');
  assert.deepEqual(calls.map(([kind]) => kind), ['event', 'candidate']);
});

test('GH3.10: replay is deterministic for existing PDK4/PM3 idempotency contracts', async () => {
  const { service } = harness();
  const first = await service.ingestVerifiedOutcome(base());
  const replay = await service.ingestVerifiedOutcome(base());
  assert.equal(replay.developmentEvent.eventId, first.developmentEvent.eventId);
  assert.equal(replay.developmentEvent.semanticFingerprint, first.developmentEvent.semanticFingerprint);
  assert.equal(replay.projectMemoryCandidate.sourceEventId, first.projectMemoryCandidate.sourceEventId);
  assert.equal(replay.projectMemoryCandidate.semanticFingerprint, first.projectMemoryCandidate.semanticFingerprint);
});

test('GH3.10: successful workflow verifies only the exact target HEAD', async () => {
  const { service } = harness();
  const result = await service.ingestVerifiedOutcome(base({ type: 'workflow', runId: 8587, attempt: 1, conclusion: 'success', targetSha: SHA }));
  assert.equal(result.developmentEvent.eventType, 'ci-verification');
  assert.equal(result.developmentEvent.newState, 'ci-verified');
  assert.equal(result.developmentEvent.verification[0].kind, 'ci');
  await assert.rejects(() => service.ingestVerifiedOutcome(base({ type: 'workflow', runId: 8587, conclusion: 'success', targetSha: OTHER_SHA })), (error) => error.code === 'gh3-evidence-exact-head-mismatch');
  await assert.rejects(() => service.ingestVerifiedOutcome(base({ type: 'workflow', runId: 8587, conclusion: 'failure', targetSha: SHA })), (error) => error.code === 'gh3-evidence-ci-not-verified');
});

test('GH3.10: verified PR remains code evidence and cannot imply deployment', async () => {
  const { service } = harness();
  const result = await service.ingestVerifiedOutcome(base({ type: 'pull-request', number: 42 }));
  assert.equal(result.developmentEvent.provenance[0].kind, 'github-pr');
  assert.equal(result.developmentEvent.newState, 'implemented');
  assert.equal(result.deployed, false);
  assert.equal(result.liveVerified, false);
});

test('GH3.10: model self-confirmation and repository-to-runtime promotion fail closed', async () => {
  const { service } = harness();
  await assert.rejects(() => service.ingestVerifiedOutcome(base({ modelGenerated: true })), (error) => error.code === 'gh3-evidence-self-confirmation-denied');
  await assert.rejects(() => service.ingestVerifiedOutcome(base({ confirmed: true })), (error) => error.code === 'gh3-evidence-self-confirmation-denied');
  await assert.rejects(() => service.ingestVerifiedOutcome(base({ claimedState: 'deployed' })), (error) => error.code === 'gh3-evidence-state-promotion-denied');
  await assert.rejects(() => service.ingestVerifiedOutcome(base({ claimedState: 'live-verified' })), (error) => error.code === 'gh3-evidence-state-promotion-denied');
});

test('GH3.10: PM3 promotion and cross-project PDK4 sink results are rejected', async () => {
  const promoted = harness({ mutateStored: (candidate) => ({ ...candidate, confirmed: true, confirmationState: 'confirmed', trust: 'confirmed' }) });
  await assert.rejects(() => promoted.service.ingestVerifiedOutcome(base()), (error) => error.code === 'gh3-evidence-pm3-promotion-denied');
  const service = createGitHubTrustedDevelopmentEvidenceIntegration({ clock: CLOCK, developmentEventSink: { async ingest(event) { return { ...event, projectKey: 'other' }; } }, projectMemoryStore: { async put(candidate) { return candidate; } } });
  await assert.rejects(() => service.ingestVerifiedOutcome(base()), (error) => error.code === 'gh3-evidence-pdk4-ingestion-mismatch');
});
