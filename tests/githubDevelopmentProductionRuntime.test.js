import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionGitHubDevelopmentRuntime } from '../src/githubDevelopment/githubDevelopmentProductionRuntime.js';

function harness({ authorities = [], allowed = true, capabilityBindingService = null, platformOperationsService = null } = {}) {
  const credentials = [];
  const grants = [];
  const resources = [];
  const credentialManager = {
    listCredentials: () => credentials,
    registerCredential: (record) => { credentials.push(record); return record; },
    async useCredential({ operation }) { return operation('secret-token'); }
  };
  const resourceAuthorityRegistry = {
    async listResources() { return resources; },
    async registerResource(record) { resources.push(record); return record; },
    async listAuthorities() { return authorities; },
    async grantAuthority(record) { grants.push(record); return record; },
    async checkAuthority() { return { allowed, reason: allowed ? 'resource-authority-verified' : 'resource-authority-missing' }; }
  };
  const runtime = createProductionGitHubDevelopmentRuntime({
    env: { GITHUB_TOKEN: 'configured', SG_GITHUB_DEVELOPMENT_REPOSITORY: 'korzh260609-beep/garya-bot', SG_GITHUB_DEVELOPMENT_BRANCH: 'dev/sg2.1-semantic' },
    credentialManager,
    credentialAccessContext: { actor: { globalUserId: 'system:runtime' }, scope: { projectScope: 'sg2.1' } },
    resourceAuthorityRegistry,
    resourceAuthorityAccessContext: { actor: { globalUserId: 'system:runtime', grants: ['resource-authority:manage', 'resource-authority:read'] }, projectScope: 'sg2.1' },
    ownerGlobalUserId: 'telegram:1',
    aiRouter: { async route() { throw new Error('not used by status/preflight tests'); } },
    capabilityBindingService,
    platformOperationsService,
    fetchImpl: async () => { throw new Error('not used by status/preflight tests'); }
  });
  return { runtime, credentials, grants, resources };
}

test('GH3 production runtime exposes configured repository truth and bootstraps owner authority once', async () => {
  const { runtime, credentials, grants, resources } = harness();
  await runtime.start();
  assert.equal(credentials.length, 1);
  assert.equal(resources.length, 1);
  assert.equal(grants.length, 1);
  assert.equal(runtime.availability.configured, true);
  assert.equal(runtime.availability.repository, 'korzh260609-beep/garya-bot');
  assert.equal(runtime.availability.branch, 'dev/sg2.1-semantic');
  assert.equal(runtime.availability.canonicalRuntimeBinding, true);
  const result = await runtime.capability.execute({
    actor: { globalUserId: 'telegram:1' }, scope: { projectScope: 'sg2.1' }, input: { mode: 'status', locale: 'ru' },
    actionRequest: { actionType: 'github-development-status' }, traceContext: { traceId: 't', requestId: 'r' }
  });
  assert.equal(result.status, 'success');
  assert.match(result.data.message, /готов/);
  assert.equal(result.data.authority.allowed, true);
});

test('GDE2 production status uses deterministic capability assessment instead of model or local-git assumptions', async () => {
  const assessments = [];
  const capabilityBindingService = { async assess(input) { assessments.push(input); return { available: true, message: 'deterministic-ready', blockers: [], selfKnowledge: { grantsAuthority: false } }; } };
  const { runtime } = harness({ capabilityBindingService });
  const result = await runtime.capability.execute({
    actor: { globalUserId: 'telegram:1' }, scope: { projectScope: 'sg2.1' }, input: { mode: 'status', canonicalAction: 'github.development.execute', locale: 'ru' },
    actionRequest: { actionType: 'github-development-status', traceContext: { traceId: 't', requestId: 'r' } }, traceContext: { traceId: 't', requestId: 'r' }
  });
  assert.equal(result.data.message, 'deterministic-ready');
  assert.equal(result.data.capabilityAssessment.available, true);
  assert.equal(assessments[0].repository.fullName, 'korzh260609-beep/garya-bot');
  assert.equal(Object.hasOwn(assessments[0], 'localGitAvailable'), false);
});

test('GH3 bootstrap never silently restores a revoked authority', async () => {
  const revoked = [{ authorityId: 'old', state: 'revoked', verificationState: 'verified', relation: 'can_modify' }];
  const { runtime, grants } = harness({ authorities: revoked, allowed: false });
  await runtime.start();
  assert.equal(grants.length, 0);
  const result = await runtime.capability.execute({
    actor: { globalUserId: 'telegram:1' }, scope: { projectScope: 'sg2.1' }, input: { mode: 'status', locale: 'ru' },
    actionRequest: { actionType: 'github-development-status' }, traceContext: { traceId: 't', requestId: 'r' }
  });
  assert.match(result.data.message, /не готов/);
  assert.equal(result.data.authority.allowed, false);
});

test('GH3 status truth denies non-owner even when a credential exists', async () => {
  const { runtime } = harness();
  await runtime.start();
  const result = await runtime.capability.execute({
    actor: { globalUserId: 'telegram:2' }, scope: { projectScope: 'sg2.1' }, input: { mode: 'status', locale: 'ru' },
    actionRequest: { actionType: 'github-development-status' }, traceContext: { traceId: 't', requestId: 'r' }
  });
  assert.equal(result.data.authority.allowed, false);
  assert.equal(result.data.authority.reason, 'canonical-owner-required');
});

test('GDE6 production runtime routes canonical platform actions transport-neutrally through the existing capability', async () => {
  const calls=[];const platformOperationsService={async execute(input){calls.push(input);return{canonicalAction:input.canonicalAction,result:{exactHeadVerified:true}}}};
  const {runtime}=harness({platformOperationsService});
  for(const transport of ['telegram','web-api']){const result=await runtime.capability.execute({actor:{globalUserId:'telegram:1'},scope:{projectScope:'sg2.1'},input:{canonicalAction:'github.ci.verify',platformOperation:{repository:{owner:'korzh260609-beep',name:'garya-bot'},branch:'dev/sg2.1-semantic'},transport},actionRequest:{actionType:'github-development'},traceContext:{traceId:'t',requestId:transport}});assert.equal(result.status,'success');assert.equal(result.data.canonicalAction,'github.ci.verify')}
  assert.equal(calls.length,2);assert.equal(calls[0].actor.globalUserId,'telegram:1');assert.equal(calls[1].projectScope,'sg2.1');
});

test('production execution fails closed when canonical repository or branch leaves the configured workspace', async () => {
  const { runtime } = harness({ capabilityBindingService: { async assess() { throw new Error('must not assess mismatched target'); } } });
  const result = await runtime.capability.execute({
    actor: { globalUserId: 'telegram:1' }, scope: { projectScope: 'sg2.1' },
    input: { canonicalAction: 'github.development.execute', mode: 'execute', instruction: 'Implement LA1', canonicalTarget: { repository: 'other/repo', branch: 'main' }, locale: 'ru' },
    actionRequest: { actionType: 'github-development', confirmation: { confirmed: true } }, traceContext: { traceId: 't-target', requestId: 'r-target' }
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'github-development-target-outside-workspace');
  assert.match(result.error.message, /outside the configured development workspace/);
});

test('production execution runs GDE2 capability assessment before repository mutation and exposes exact blocker', async () => {
  const assessments = [];
  const capabilityBindingService = { async assess(input) { assessments.push(input); return { available: false, message: 'missing-provider-permission', blockers: [{ code: 'missing-provider-permission' }] }; } };
  const { runtime } = harness({ capabilityBindingService });
  const result = await runtime.capability.execute({
    actor: { globalUserId: 'telegram:1' }, scope: { projectScope: 'sg2.1' },
    input: { canonicalAction: 'github.development.execute', mode: 'execute', instruction: 'Implement LA1', canonicalTarget: { repository: 'korzh260609-beep/garya-bot', branch: 'dev/sg2.1-semantic', stage: 'LA1' }, locale: 'ru' },
    actionRequest: { actionType: 'github-development', confirmation: { confirmed: true }, traceContext: { traceId: 't-preflight', requestId: 'r-preflight' } }, traceContext: { traceId: 't-preflight', requestId: 'r-preflight' }
  });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.error.code, 'github-development-capability-unavailable');
  assert.equal(result.data.capabilityAssessment.blockers[0].code, 'missing-provider-permission');
  assert.equal(assessments.length, 1);
  assert.equal(assessments[0].canonicalAction, 'github.development.execute');
  assert.equal(assessments[0].branch, 'dev/sg2.1-semantic');
});