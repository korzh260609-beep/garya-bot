import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubCapabilityRegistry, GITHUB_CAPABILITY_DEFINITIONS } from '../src/githubDevelopment/githubCapabilityRegistry.js';
import { CANONICAL_GITHUB_ACTION_CAPABILITY_BINDINGS, GITHUB_PROVIDER_CAPABILITY_REQUIREMENTS, createGitHubCapabilityBindingService } from '../src/githubDevelopment/githubCapabilityBindingService.js';

const repository = Object.freeze({ owner: 'korzh260609-beep', name: 'garya-bot', fullName: 'korzh260609-beep/garya-bot' });
function request() { return { traceContext: { traceId: 't-gde2', requestId: 'r-gde2' } }; }
function harness({ securityError = null, providerError = null, registry = createGitHubCapabilityRegistry() } = {}) {
  const calls = [];
  const service = createGitHubCapabilityBindingService({
    capabilityRegistry: registry,
    securityControlPlane: { async authorize(input) { calls.push(['security', input.capability]); if (securityError) throw Object.assign(new Error(securityError.message), { code: securityError.code }); return { allowed: true, capability: input.capability, gateOutcome: 'allow', emergencyMode: 'normal' }; } },
    providerCapabilityProbe: { async check(input) { calls.push(['provider', input.capability]); if (providerError) throw Object.assign(new Error(providerError.message), { code: providerError.code }); return { allowed: true, permission: GITHUB_PROVIDER_CAPABILITY_REQUIREMENTS[input.capability][0] }; } },
    clock: () => new Date('2026-08-22T12:00:00.000Z')
  });
  return { service, calls };
}
function input(action = 'github.development.execute') { return { canonicalAction: action, actor: { globalUserId: 'usr-monarch' }, projectScope: 'sg2.1', repository, repositoryResourceId: 'github:repo:korzh260609-beep/garya-bot', branch: 'dev/sg2.1-semantic', paths: ['src/**'], connectionId: 'github-development', credentialId: 'sg.github.development', actionRequest: request(), locale: 'ru' }; }

test('GDE2 maps every canonical GitHub action only to existing GH3 capabilities', () => {
  const registered = new Set(GITHUB_CAPABILITY_DEFINITIONS.map((item) => item.name));
  for (const capabilities of Object.values(CANONICAL_GITHUB_ACTION_CAPABILITY_BINDINGS)) for (const capability of capabilities) assert.ok(registered.has(capability), capability);
  assert.deepEqual(CANONICAL_GITHUB_ACTION_CAPABILITY_BINDINGS['github.development.execute'], ['github.repository.read','github.code.search','github.contents.write','github.commit.create']);
});

test('GDE2 reports write availability only after security and provider checks pass', async () => {
  const { service, calls } = harness();
  const result = await service.assess(input());
  assert.equal(result.available, true);
  assert.equal(result.checks.length, 4);
  assert.deepEqual(calls.map((item) => item[0]), ['security','provider','security','provider','security','provider','security','provider']);
  assert.equal(result.selfKnowledge.value.localFilesystemRelevant, false);
  assert.equal(result.selfKnowledge.grantsAuthority, false);
  assert.match(result.message, /доступно/);
});

test('GDE2 exposes exact deterministic blockers and stops before provider credential use when security denies', async () => {
  const cases = [
    ['gh3-security-acs-denied','actor-capability-denied'],
    ['gh3-security-resource-authority-denied','resource-authority-denied'],
    ['gh3-security-action-gate-denied','action-gate-denied'],
    ['gh3-security-separate-confirmation-required','action-gate-confirmation-required'],
    ['gh3-security-emergency-disabled','emergency-mode-blocked']
  ];
  for (const [source, expected] of cases) {
    const { service, calls } = harness({ securityError: { code: source, message: source } });
    const result = await service.assess(input());
    assert.equal(result.available, false);
    assert.equal(result.blockers[0].code, expected);
    assert.equal(calls.some(([type]) => type === 'provider'), false);
  }
});

test('GDE2 distinguishes connection, provider permission and repository-installation blockers', async () => {
  const cases = [
    ['connection-not-found','missing-github-connection'],
    ['gh3-provider-permission-unavailable','missing-provider-permission'],
    ['gh3-repository-not-selected','repository-outside-authorized-installation']
  ];
  for (const [source, expected] of cases) {
    const result = await harness({ providerError: { code: source, message: source } }).service.assess(input('github.file.update'));
    assert.equal(result.blockers[0].code, expected);
    assert.match(result.message, new RegExp(expected));
  }
});

test('GDE2 rejects false no-access conclusions based on absent local git workspace or model text', async () => {
  const { service } = harness();
  const result = await service.assess({ ...input('github.repository.inspect'), modelClaim: 'I cannot access GitHub', localGitAvailable: false });
  assert.equal(result.available, true);
  assert.equal(result.blockers.length, 0);
  assert.equal(JSON.stringify(result).includes('I cannot access GitHub'), false);
});

test('GDE2 fails closed when a mapped capability is not actually registered', async () => {
  const registry = createGitHubCapabilityRegistry({ definitions: GITHUB_CAPABILITY_DEFINITIONS.filter((item) => item.name !== 'github.commit.create') });
  const result = await harness({ registry }).service.assess(input());
  assert.equal(result.available, false);
  assert.equal(result.blockers[0].code, 'registered-capability-missing');
});
