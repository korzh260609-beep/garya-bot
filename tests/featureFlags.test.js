import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeatureFlagService, stableBucket } from '../src/features/featureFlags.js';

const authorized = {
  environment: 'production', projectScope: 'sg2.1', globalUserId: 'user:1', roles: ['monarch'],
  resourceId: 'resource:1', cohorts: ['testers'], permissionSatisfied: true, authoritySatisfied: true, actionGateSatisfied: true
};

test('Block 16.16 missing and disabled flags fail closed', async () => {
  const service = createFeatureFlagService();
  assert.equal((await service.resolve('missing', authorized)).enabled, false);
  await service.setFlag({ featureId: 'feature:a', enabled: false });
  const disabled = await service.resolve('feature:a', authorized);
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.reasonCode, 'disabled');
});

test('Block 16.16 supports monarch/test cohort/project restriction before broad rollout', async () => {
  const service = createFeatureFlagService();
  await service.setFlag({ featureId: 'feature:pilot', enabled: true, projects: ['sg2.1'], roles: ['monarch'], cohorts: ['testers'] });
  assert.equal((await service.resolve('feature:pilot', authorized)).enabled, true);
  assert.equal((await service.resolve('feature:pilot', { ...authorized, roles: ['guest'] })).enabled, false);
  assert.equal((await service.resolve('feature:pilot', { ...authorized, cohorts: [] })).enabled, false);
  assert.equal((await service.resolve('feature:pilot', { ...authorized, projectScope: 'other' })).enabled, false);
});

test('Block 16.16 kill switch overrides every targeting rule immediately', async () => {
  const service = createFeatureFlagService();
  await service.setFlag({ featureId: 'feature:killed', enabled: true, killSwitch: true, users: ['user:1'], percentage: 10000 });
  const decision = await service.resolve('feature:killed', authorized);
  assert.equal(decision.enabled, false);
  assert.equal(decision.source, 'kill-switch');
});

test('Block 16.16 stable percentage bucketing is deterministic', async () => {
  const a = stableBucket({ featureId: 'feature:rollout', subjectKey: 'user:123' });
  const b = stableBucket({ featureId: 'feature:rollout', subjectKey: 'user:123' });
  assert.equal(a, b);
  assert.ok(a >= 0 && a < 10000);
  const service = createFeatureFlagService();
  await service.setFlag({ featureId: 'feature:rollout', enabled: true, percentage: a + 1 });
  assert.equal((await service.resolve('feature:rollout', { ...authorized, globalUserId: 'user:123', subjectKey: 'user:123' })).enabled, true);
  await service.setFlag({ featureId: 'feature:rollout', enabled: true, percentage: a });
  assert.equal((await service.resolve('feature:rollout', { ...authorized, globalUserId: 'user:123', subjectKey: 'user:123' })).enabled, false);
});

test('Block 16.16 flags never grant permission, authority or Action Gate approval', async () => {
  const service = createFeatureFlagService();
  await service.setFlag({ featureId: 'feature:protected', enabled: true });
  assert.equal((await service.resolve('feature:protected', { ...authorized, permissionSatisfied: false })).reasonCode, 'authorization-not-satisfied');
  assert.equal((await service.resolve('feature:protected', { ...authorized, authoritySatisfied: false })).enabled, false);
  assert.equal((await service.resolve('feature:protected', { ...authorized, actionGateSatisfied: false })).enabled, false);
});

test('Block 16.16 temporary flags require review/expiry and expired flags fail closed', async () => {
  let now = new Date('2026-08-08T18:00:00.000Z');
  const service = createFeatureFlagService({ clock: () => new Date(now) });
  await assert.rejects(() => service.setFlag({ featureId: 'feature:bad-temp', enabled: true, temporary: true }), /require/);
  await service.setFlag({ featureId: 'feature:temp', enabled: true, temporary: true, expiresAt: '2026-08-08T18:01:00.000Z' });
  assert.equal((await service.resolve('feature:temp', authorized)).enabled, true);
  now = new Date('2026-08-08T18:02:00.000Z');
  const expired = await service.resolve('feature:temp', authorized);
  assert.equal(expired.enabled, false);
  assert.equal(expired.reasonCode, 'expired');
});

test('Block 16.16 Configuration & Policy integration can only tighten feature availability', async () => {
  const service = createFeatureFlagService({ policyResolver: async () => ({ enabled: false, reasonCode: 'environment-policy-disabled' }) });
  await service.setFlag({ featureId: 'feature:policy', enabled: true });
  const decision = await service.resolve('feature:policy', authorized);
  assert.equal(decision.enabled, false);
  assert.equal(decision.source, 'configuration-policy');
});

test('Block 16.16 observability diagnoses effective flag source without user phrases', async () => {
  const records = [];
  const service = createFeatureFlagService({ observability: { record: async record => records.push(record) } });
  await service.setFlag({ featureId: 'feature:obs', enabled: true, roles: ['monarch'] });
  await service.resolve('feature:obs', authorized);
  assert.equal(records.length, 1);
  assert.equal(records[0].data.featureId, 'feature:obs');
  assert.equal(records[0].data.source, 'flag');
  assert.equal(JSON.stringify(records[0]).includes('message'), false);
  assert.equal(JSON.stringify(records[0]).includes('phrase'), false);
});
