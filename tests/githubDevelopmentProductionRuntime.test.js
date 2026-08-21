import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionGitHubDevelopmentRuntime } from '../src/githubDevelopment/githubDevelopmentProductionRuntime.js';

function harness({ authorities = [], allowed = true } = {}) {
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
    aiRouter: { async route() { throw new Error('not used by status test'); } },
    fetchImpl: async () => { throw new Error('not used by status test'); }
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
  const result = await runtime.capability.execute({
    actor: { globalUserId: 'telegram:1' }, scope: { projectScope: 'sg2.1' }, input: { mode: 'status', locale: 'ru' },
    actionRequest: { actionType: 'github-development-status' }, traceContext: { traceId: 't', requestId: 'r' }
  });
  assert.equal(result.status, 'success');
  assert.match(result.data.message, /готов/);
  assert.equal(result.data.authority.allowed, true);
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
