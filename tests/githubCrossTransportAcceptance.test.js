import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubCrossTransportAcceptanceRunner, validateGitHubCrossTransportAcceptanceEvidence } from '../src/githubDevelopment/githubCrossTransportAcceptance.js';

const SHA0 = '1111111111111111111111111111111111111111';
const SHA1 = '2222222222222222222222222222222222222222';
const SHA2 = '3333333333333333333333333333333333333333';

function acceptedEvidence(overrides = {}) {
  return {
    acceptanceId: 'gh3.12-live-boundary-1',
    repository: 'korzh260609-beep/garya-bot',
    branch: 'dev/sg2.1-semantic',
    publicDiscovery: { qualified: true, readOnly: true, sourceClass: 'public' },
    privateIsolation: { denied: true, reason: 'not-authorized' },
    task: { taskId: 'dev-task-1', actorGlobalUserId: 'usr-monarch', projectScope: 'sg2.1', startTransport: 'telegram' },
    baseline: { repository: 'korzh260609-beep/garya-bot', branch: 'dev/sg2.1-semantic', headSha: SHA0, canonicalDocsVerified: true, ci: { sha: SHA0, conclusion: 'success' } },
    mutation: { repository: 'korzh260609-beep/garya-bot', branch: 'dev/sg2.1-semantic', baselineSha: SHA0, commitSha: SHA1, atomic: true, changedPaths: ['src/a.js', 'tests/a.test.js'] },
    pullRequest: { number: 12, headSha: SHA1 },
    failedCI: { sha: SHA1, conclusion: 'failure', actionableFailureLocated: true, runId: 101, jobId: 102 },
    repair: { baselineSha: SHA1, commitSha: SHA2 },
    greenCI: { sha: SHA2, conclusion: 'success', runId: 103 },
    restartResume: { taskId: 'dev-task-1', reconciledLiveState: true, duplicateCommits: 0, duplicatePullRequests: 0, duplicateWorkflowDispatches: 0 },
    transportContinuation: { transport: 'web-api', taskId: 'dev-task-1', actorGlobalUserId: 'usr-monarch', projectScope: 'sg2.1' },
    protectedOperation: { allowed: false, separateConfirmationRequired: true },
    idempotency: { duplicateExternalActions: false },
    secretSafety: { leaked: false, redactionVerified: true },
    developmentEvidence: { codeQualified: true, ciQualified: true, pm3CandidateStatus: 'proposed', pm3Confirmed: false, deployedClaim: false, liveVerifiedClaim: false },
    ...overrides
  };
}

test('GH3.12: validates complete cross-transport development acceptance evidence', () => {
  const result = validateGitHubCrossTransportAcceptanceEvidence(acceptedEvidence());
  assert.equal(result.accepted, true);
  assert.equal(result.baselineSha, SHA0);
  assert.equal(result.mutationSha, SHA1);
  assert.equal(result.repairedSha, SHA2);
  assert.equal(result.startTransport, 'telegram');
  assert.equal(result.continuationTransport, 'web-api');
});

test('GH3.12: runner executes the canonical live sequence and proves restart/idempotency continuity', async () => {
  const calls = [];
  const runner = createGitHubCrossTransportAcceptanceRunner({
    clock: () => new Date('2026-08-20T12:30:00.000Z'),
    scenario: {
      async discoverPublic() { calls.push('discover'); return { qualified: true, readOnly: true, sourceClass: 'public' }; },
      async provePrivateIsolation() { calls.push('private-denial'); return { denied: true }; },
      async startTask() { calls.push('task'); return { taskId: 'dev-task-1' }; },
      async verifyBaseline(ctx) { calls.push('baseline'); return { repository: ctx.repository, branch: ctx.branch, headSha: SHA0, canonicalDocsVerified: true, ci: { sha: SHA0, conclusion: 'success' } }; },
      async mutateAndOpenPullRequest(ctx) { calls.push('mutation-pr'); return { mutation: { repository: ctx.repository, branch: ctx.branch, baselineSha: SHA0, commitSha: SHA1, atomic: true, changedPaths: ['src/a.js', 'tests/a.test.js'] }, pullRequest: { number: 12, headSha: SHA1 } }; },
      async observeFailedCI() { calls.push('failed-ci'); return { sha: SHA1, conclusion: 'failure', actionableFailureLocated: true }; },
      async repairAndReachGreen() { calls.push('repair-green'); return { repair: { baselineSha: SHA1, commitSha: SHA2 }, greenCI: { sha: SHA2, conclusion: 'success' } }; },
      async restartAndResume() { calls.push('restart'); return { taskId: 'dev-task-1', reconciledLiveState: true, duplicateCommits: 0, duplicatePullRequests: 0, duplicateWorkflowDispatches: 0 }; },
      async continueFromSecondTransport(ctx) { calls.push('second-transport'); return { transport: ctx.continuationTransport, taskId: 'dev-task-1', actorGlobalUserId: ctx.actorGlobalUserId, projectScope: ctx.projectScope }; },
      async proveProtectedDenial() { calls.push('protected-denial'); return { allowed: false, separateConfirmationRequired: true }; },
      async ingestDevelopmentEvidence() { calls.push('evidence'); return { codeQualified: true, ciQualified: true, pm3CandidateStatus: 'proposed', pm3Confirmed: false, deployedClaim: false, liveVerifiedClaim: false }; },
      async proveSecretSafety() { calls.push('secret-safety'); return { leaked: false }; }
    }
  });

  const result = await runner.run({ acceptanceId: 'gh3.12-live-boundary-1', repository: 'korzh260609-beep/garya-bot', branch: 'dev/sg2.1-semantic', actorGlobalUserId: 'usr-monarch', projectScope: 'sg2.1', startTransport: 'telegram', continuationTransport: 'web-api' });
  assert.equal(result.accepted, true);
  assert.deepEqual(calls, ['discover','private-denial','task','baseline','mutation-pr','failed-ci','repair-green','restart','second-transport','protected-denial','evidence','secret-safety']);
  assert.equal(result.evidence.idempotency.duplicateExternalActions, false);
});

test('GH3.12: rejects green CI from another SHA, duplicate restart effects and same-transport continuation', () => {
  assert.throws(() => validateGitHubCrossTransportAcceptanceEvidence(acceptedEvidence({ greenCI: { sha: SHA1, conclusion: 'success' } })), (error) => error.code === 'gh3-acceptance-green-ci-invalid');
  assert.throws(() => validateGitHubCrossTransportAcceptanceEvidence(acceptedEvidence({ restartResume: { taskId: 'dev-task-1', reconciledLiveState: true, duplicateCommits: 1, duplicatePullRequests: 0, duplicateWorkflowDispatches: 0 } })), (error) => error.code === 'gh3-acceptance-restart-duplicate');
  assert.throws(() => validateGitHubCrossTransportAcceptanceEvidence(acceptedEvidence({ transportContinuation: { transport: 'telegram', taskId: 'dev-task-1', actorGlobalUserId: 'usr-monarch', projectScope: 'sg2.1' } })), (error) => error.code === 'gh3-acceptance-cross-transport-missing');
});

test('GH3.12: rejects unverified canonical docs, missing private denial and unsafe lifecycle promotion', () => {
  assert.throws(() => validateGitHubCrossTransportAcceptanceEvidence(acceptedEvidence({ baseline: { repository: 'korzh260609-beep/garya-bot', branch: 'dev/sg2.1-semantic', headSha: SHA0, canonicalDocsVerified: false, ci: { sha: SHA0, conclusion: 'success' } } })), (error) => error.code === 'gh3-acceptance-docs-unverified');
  assert.throws(() => validateGitHubCrossTransportAcceptanceEvidence(acceptedEvidence({ privateIsolation: { denied: false } })), (error) => error.code === 'gh3-acceptance-private-isolation-failed');
  assert.throws(() => validateGitHubCrossTransportAcceptanceEvidence(acceptedEvidence({ developmentEvidence: { codeQualified: true, ciQualified: true, pm3CandidateStatus: 'confirmed', pm3Confirmed: true, deployedClaim: true, liveVerifiedClaim: true } })), (error) => ['gh3-acceptance-pm3-promotion-invalid','gh3-acceptance-lifecycle-promotion-invalid'].includes(error.code));
});

test('GH3.12: rejects secret-shaped evidence fields', () => {
  assert.throws(() => validateGitHubCrossTransportAcceptanceEvidence(acceptedEvidence({ secretSafety: { leaked: false, token: 'must-never-appear' } })), (error) => error.code === 'gh3-acceptance-secret-material');
});
