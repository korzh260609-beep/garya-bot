import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGitHubRepositoryIdentity,
  createGitHubRef,
  createGitHubRevision,
  createGitHubCompletionCondition,
  createGitHubMutationPlan,
  createGitHubCIRun,
  createGitHubDevelopmentTask,
  assertSameGitHubRepository
} from '../src/githubDevelopment/githubDevelopmentContract.js';
import { createGitHubCapabilityRegistry, GITHUB_CAPABILITY_DEFINITIONS } from '../src/githubDevelopment/githubCapabilityRegistry.js';

const SHA = 'a'.repeat(40);
const repository = { owner: 'korzh260609-beep', name: 'garya-bot', repositoryId: 'repo-1' };
const revision = { repository, sha: SHA };

test('normalizes explicit transport-neutral repository, ref and immutable revision identity', () => {
  assert.equal(createGitHubRepositoryIdentity(repository).fullName, 'korzh260609-beep/garya-bot');
  assert.deepEqual(createGitHubRef({ kind: 'branch', name: 'dev/sg2.1-semantic' }), { kind: 'branch', name: 'dev/sg2.1-semantic' });
  assert.equal(createGitHubRevision(revision).sha, SHA);
});

test('rejects abbreviated revisions and cross-repository identity', () => {
  assert.throws(() => createGitHubRevision({ repository, sha: 'abc1234' }), /full 40-character/);
  assert.throws(() => assertSameGitHubRepository(repository, { owner: 'other', name: 'repo' }), (error) => error.code === 'gh3-cross-repository-denied');
});

test('requires bounded explicit completion conditions', () => {
  const condition = createGitHubCompletionCondition({ kind: 'exact-head-ci-green', maxAttempts: 4, targetWorkflow: 'SG 2.1 CI', evidenceRequirements: ['exact-head'] });
  assert.equal(condition.maxAttempts, 4);
  assert.throws(() => createGitHubCompletionCondition({ kind: 'exact-head-ci-green', maxAttempts: 21 }), /1 to 20/);
  assert.throws(() => createGitHubCompletionCondition({ kind: 'exact-head-ci-green', maxAttempts: 1 }), /targetWorkflow/);
});

test('mutation plan is bound to baseline, target ref, unique safe paths and idempotency', () => {
  const plan = createGitHubMutationPlan({
    repository,
    targetRef: { kind: 'branch', name: 'dev/sg2.1-semantic' },
    baseline: revision,
    changes: [{ operation: 'update', path: 'src/example.js', expectedBlobSha: SHA }],
    commitMessage: 'Implement bounded change',
    idempotencyKey: 'task-1:attempt-1'
  });
  assert.equal(plan.baseline.sha, SHA);
  assert.throws(() => createGitHubMutationPlan({ ...plan, changes: [{ operation: 'delete', path: '../secret' }] }), /traversal-safe/);
});

test('CI evidence always carries exact repository revision', () => {
  const run = createGitHubCIRun({ repository, revision, runId: '8551', workflow: 'SG 2.1 CI', status: 'completed', conclusion: 'success', observedAt: '2026-08-20T08:00:00Z' });
  assert.equal(run.revision.sha, SHA);
  assert.equal(run.conclusion, 'success');
});

test('development task binds canonical actor/project/repository scope without transport fields', () => {
  const task = createGitHubDevelopmentTask({
    taskId: 'ghdt-1', globalUserId: 'user-1', projectId: 'sg-2.1', repository,
    targetRef: { kind: 'branch', name: 'dev/sg2.1-semantic' }, baseline: revision,
    intent: 'Implement GH3.1', allowedOperations: ['github.repository.read'], allowedPaths: ['src/githubDevelopment/**'],
    completionCondition: { kind: 'exact-head-ci-green', maxAttempts: 3, targetWorkflow: 'SG 2.1 CI' }
  });
  assert.equal(task.globalUserId, 'user-1');
  assert.equal('transport' in task, false);
  assert.throws(() => createGitHubDevelopmentTask({ ...task, baseline: { repository: { owner: 'other', name: 'repo' }, sha: SHA } }), /must match/);
});

test('capability registry contains bounded families and cannot grant authority', () => {
  const registry = createGitHubCapabilityRegistry();
  assert.equal(registry.list().length, GITHUB_CAPABILITY_DEFINITIONS.length);
  assert.equal(registry.require('github.discovery.public.read').defaultDecision, 'read-only');
  assert.equal(registry.require('github.repository.admin').defaultDecision, 'deny');
  assert.equal(registry.require('github.repository.admin').separateConfirmationRequired, true);
  assert.equal(registry.list().every((entry) => entry.grantsAuthority === false), true);
});

test('risk tier 3 and 4 definitions cannot be registered as allow-by-default', () => {
  assert.throws(() => createGitHubCapabilityRegistry({ definitions: [{ name: 'github.release.write', riskTier: 3, defaultDecision: 'allow' }] }), /default-deny/);
});
