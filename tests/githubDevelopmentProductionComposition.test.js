import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanonicalSemanticModel } from '../src/contracts/semantic.js';
import { createGitHubDevelopmentProductionComposition } from '../src/githubDevelopment/githubDevelopmentProductionComposition.js';

const HEAD = 'a'.repeat(40);
const NEXT = 'b'.repeat(40);
const repository = 'korzh260609-beep/garya-bot';
const branch = 'dev/sg2.1-semantic';

function canonical(action, target) {
  return createCanonicalSemanticModel({ resolutionStatus: 'resolved', intent: action === 'github.development.execute' ? 'github-development' : 'github-repository-inspect', goal: 'github-runtime', target, action: { type: 'github-development', name: action, actionClass: action === 'github.development.execute' ? 'state-change' : 'read-only' }, timeExpression: null, scope: { projectScope: 'sg2.1' }, parameters: { instruction: action === 'github.development.execute' ? 'Реализуй этап LA1 — Activity Event Core' : 'Ты видишь блок LA в репозитории?' }, delivery: null, confidence: 0.99, missingInformation: [], clarificationQuestion: null, provenance: {}, diagnostics: {} });
}

function input(text) { return { text, locale: 'ru', identityContext: { globalUserId: 'telegram:owner', roles: ['monarch'] }, scopeContext: { projectScope: 'sg2.1' }, traceContext: { traceId: 't-production', requestId: 'r-production' }, metadata: { transport: 'telegram' } }; }

test('production composition routes LA1 canonical execution through GDE1, GDE3 and the existing GH3 executor', async () => {
  const reads = [], executions = [];
  const repositoryReadService = { async readSnapshot(request) { reads.push(request); return { repository: { fullName: repository }, revision: HEAD, tree: { entries: [{ type: 'blob', path: 'pillars/roadmap/LIFECYCLE_ACTIVITY.md', sha: 'c'.repeat(40) }] }, files: [{ path: 'pillars/roadmap/LIFECYCLE_ACTIVITY.md', content: '# LA\n## LA1', sha: 'c'.repeat(40) }], provenance: { source: `github:${repository}@${HEAD}`, immutableRevisionVerified: true } }; } };
  const composition = createGitHubDevelopmentProductionComposition({ repository, branch, connectionId: 'github-development', repositoryReadService, atomicCommitService: { async applyAtomicCommit() { return { commitSha: NEXT }; } }, developmentExecutionService: { async execute(request) { executions.push(request); return { status: 'success', repository, branch, baselineSha: HEAD, commitSha: NEXT, changedPaths: ['src/activity.js'], summary: 'LA1 implemented', pushVerified: true }; } }, capabilityBindingService: {}, securityControlPlane: null, githubProvider: { async withInstallationToken() { throw new Error('platform operation not used'); } }, fetchImpl: async () => { throw new Error('provider operation not used'); } });
  const canonicalInput = input('Реализуй этап LA1 — Activity Event Core');
  const canonicalModel = canonical('github.development.execute', { repository, branch, stage: 'LA1', paths: ['src/activity.js'] });
  const resolvedTarget = await composition.targetResolver.resolve({ canonicalModel, canonicalInput });
  const result = await composition.canonicalExecutionBridge.execute({ canonicalInput, canonicalModel, resolvedTarget, capabilityAssessment: { available: true, capabilities: ['github.repository.read', 'github.code.search', 'github.contents.write', 'github.commit.create'] } });
  assert.equal(resolvedTarget.baselineHead, HEAD);
  assert.equal(result.execution.commitSha, NEXT);
  assert.equal(result.execution.pushVerified, true);
  assert.equal(executions.length, 1);
  assert.match(executions[0].instruction, /LA1/);
  assert.ok(reads.length >= 2);
});

test('production composition resolves repository read-flow from exact GitHub evidence without mutation', async () => {
  let mutations = 0;
  const repositoryReadService = { async readSnapshot() { return { repository: { fullName: repository }, revision: HEAD, files: [{ path: 'pillars/roadmap/LIFECYCLE_ACTIVITY.md', content: '# LA', sha: 'c'.repeat(40) }], provenance: { source: `github:${repository}@${HEAD}`, immutableRevisionVerified: true } }; } };
  const composition = createGitHubDevelopmentProductionComposition({ repository, branch, connectionId: 'github-development', repositoryReadService, atomicCommitService: { async applyAtomicCommit() { mutations += 1; } }, developmentExecutionService: { async execute() { mutations += 1; } }, githubProvider: { async withInstallationToken() { throw new Error('not used'); } }, fetchImpl: async () => { throw new Error('not used'); } });
  const canonicalInput = input('Ты видишь блок LA в репозитории?');
  const resolved = await composition.targetResolver.resolve({ canonicalModel: canonical('github.repository.inspect', { repository, branch, block: 'LA' }), canonicalInput });
  assert.equal(resolved.repository.fullName, repository);
  assert.equal(resolved.baselineHead, HEAD);
  assert.equal(mutations, 0);
});
