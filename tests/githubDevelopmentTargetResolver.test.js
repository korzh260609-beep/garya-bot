import test from 'node:test';
import assert from 'node:assert/strict';
import { CANONICAL_GITHUB_ACTIONS, createCanonicalSemanticModel } from '../src/contracts/semantic.js';
import { createGitHubDevelopmentTargetResolver } from '../src/githubDevelopment/githubDevelopmentTargetResolver.js';

const HEAD = 'a'.repeat(40);
const binding = Object.freeze({ authoritative: true, projectScope: 'sg2.1', repository: 'korzh260609-beep/garya-bot', branch: 'dev/sg2.1-semantic', visibility: 'authorized-private', connectionId: 'github-development' });
function canonical(target = { stage: 'LA1' }) { return createCanonicalSemanticModel({ resolutionStatus: 'resolved', intent: 'github-development', goal: 'execute-github-development', target, action: { type: 'github-development', name: 'github.development.execute', actionClass: 'state-change' }, timeExpression: null, scope: { projectScope: 'sg2.1' }, parameters: { completionCondition: { kind: 'exact-head-ci-green' } }, delivery: null, confidence: 0.98, missingInformation: [], clarificationQuestion: null, provenance: {}, diagnostics: {} }); }
function input(transport = 'telegram') { return { text: 'implement', locale: 'en', identityContext: { globalUserId: 'user-1' }, scopeContext: { projectScope: 'sg2.1' }, traceContext: { traceId: 't', requestId: 'r' }, metadata: { transport } }; }
function harness(overrides = {}, snapshotOverrides = {}) {
  const calls = [];
  const context = { bindings: [binding], canonicalDocumentPaths: ['README.md', 'pillars/roadmap/ROADMAP.md'], projectContext: { developmentTargets: [{ id: 'LA1', authoritative: true, kind: 'stage', paths: ['src/la/**'], completionCondition: { kind: 'exact-head-ci-green' } }] }, ...overrides };
  const resolver = createGitHubDevelopmentTargetResolver({ contextProvider: { async getAuthoritativeContext() { return context; } }, repositoryReadService: { async readSnapshot(request) { calls.push(request); return { repository: { fullName: binding.repository }, revision: HEAD, files: [{ path: 'README.md' }], provenance: { source: `github:${binding.repository}@${HEAD}`, immutableRevisionVerified: true }, ...snapshotOverrides }; } } });
  return { resolver, calls };
}

test('GDE1 exposes the bounded canonical GitHub action vocabulary', () => {
  assert.deepEqual(CANONICAL_GITHUB_ACTIONS, ['github.repository.inspect','github.code.search','github.file.read','github.file.create','github.file.update','github.file.delete','github.development.plan','github.development.execute','github.test.run','github.commit.create','github.push.execute','github.ci.verify','github.pr.inspect','github.pr.create','github.issue.inspect','github.issue.create']);
  assert.throws(() => createCanonicalSemanticModel({ ...canonical(), action: { type: 'github-development', name: 'github.magic.execute', actionClass: 'state-change' } }), /unsupported canonical GitHub action/);
});

test('GDE1 resolves semantic-equivalent transports to one authoritative exact target', async () => {
  const { resolver, calls } = harness();
  const telegram = await resolver.resolve({ canonicalModel: canonical(), canonicalInput: input('telegram') });
  const web = await resolver.resolve({ canonicalModel: canonical(), canonicalInput: input('web-api') });
  assert.deepEqual(telegram, web);
  assert.equal(telegram.repository.fullName, binding.repository);
  assert.equal(telegram.branch, binding.branch);
  assert.equal(telegram.baselineHead, HEAD);
  assert.equal(telegram.developmentScope.id, 'LA1');
  assert.equal(calls[0].ref.name, binding.branch);
  assert.deepEqual(calls[0].files, ['README.md', 'pillars/roadmap/ROADMAP.md']);
});

test('GDE1 fails closed for ambiguous repository, branch, scope and unverified HEAD', async () => {
  const ambiguous = harness({ bindings: [binding, { ...binding, branch: 'dev/other' }] }).resolver;
  await assert.rejects(() => ambiguous.resolve({ canonicalModel: canonical(), canonicalInput: input() }), (error) => error.code === 'gde1-authoritative-target-ambiguous');
  const missingScope = harness({ projectContext: { developmentTargets: [] } }).resolver;
  await assert.rejects(() => missingScope.resolve({ canonicalModel: canonical(), canonicalInput: input() }), (error) => error.code === 'gde1-development-scope-not-found');
  const main = harness({ bindings: [{ ...binding, branch: 'main' }] }).resolver;
  await assert.rejects(() => main.resolve({ canonicalModel: canonical({ stage: 'LA1', branch: 'main' }), canonicalInput: input() }), (error) => error.code === 'gde1-branch-denied');
  const unverified = harness({}, { revision: 'short-sha' }).resolver;
  await assert.rejects(() => unverified.resolve({ canonicalModel: canonical(), canonicalInput: input() }), (error) => error.code === 'gde1-baseline-head-unverified');
});

test('GDE1 uses only authoritative structured stage evidence, never source-text phrase routing', async () => {
  const { resolver } = harness();
  const resolved = await resolver.resolve({ canonicalModel: canonical({ stage: 'la1' }), canonicalInput: { ...input(), text: 'completely different wording' } });
  assert.equal(resolved.developmentScope.id, 'LA1');
  await assert.rejects(() => resolver.resolve({ canonicalModel: canonical({ stage: 'unknown' }), canonicalInput: { ...input(), text: 'реализуй LA1' } }), (error) => error.code === 'gde1-development-scope-not-found');
});
