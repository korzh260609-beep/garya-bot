import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTelegramWorkspaceProductionAcceptance,
  TELEGRAM_WORKSPACE_ACCEPTANCE_SCENARIOS
} from '../src/telegramWorkspace/index.js';

function observation({ step, workspaceId, telegramChatId, index = 0 }) {
  return Object.freeze({
    step,
    source: 'telegram-production',
    passed: true,
    timestamp: `2026-08-12T17:${String(index).padStart(2, '0')}:00.000Z`,
    traceId: `trace-${workspaceId}-${index}`,
    requestId: `request-${workspaceId}-${index}`,
    workspaceId,
    telegramChatId,
    actorGlobalUserId: 'usr_acceptance_admin',
    configVersion: index + 1
  });
}

function scenario(kind, primaryWorkspaceId, isolatedWorkspaceId, primaryChatId, isolatedChatId) {
  const steps = TELEGRAM_WORKSPACE_ACCEPTANCE_SCENARIOS[kind];
  return Object.freeze({
    primaryWorkspaceId,
    isolatedWorkspaceId,
    observations: Object.freeze(steps.map((step, index) => observation({
      step,
      workspaceId: step === 'second-workspace-isolated' ? isolatedWorkspaceId : primaryWorkspaceId,
      telegramChatId: step === 'second-workspace-isolated' ? isolatedChatId : primaryChatId,
      index
    })))
  });
}

function validManifest() {
  return Object.freeze({
    environment: 'production',
    revision: '0123456789abcdef0123456789abcdef01234567',
    executedAt: '2026-08-12T17:45:00.000Z',
    group: scenario('group', 'tgw_group_primary', 'tgw_group_isolated', '-1001001', '-1001002'),
    channel: scenario('channel', 'tgw_channel_primary', 'tgw_channel_isolated', '-1002001', '-1002002')
  });
}

test('TWM1.12 accepts complete ordered live production group and channel evidence', async () => {
  const acceptance = createTelegramWorkspaceProductionAcceptance();
  const result = await acceptance.verify(validManifest());
  assert.equal(result.status, 'passed');
  assert.equal(result.version, 'twm1.12');
  assert.equal(result.source, 'telegram-production');
  assert.equal(result.group.passed, true);
  assert.equal(result.channel.passed, true);
  assert.equal(result.group.observations.length, TELEGRAM_WORKSPACE_ACCEPTANCE_SCENARIOS.group.length);
  assert.equal(result.channel.observations.length, TELEGRAM_WORKSPACE_ACCEPTANCE_SCENARIOS.channel.length);
});

test('TWM1.12 rejects synthetic/non-live observations', async () => {
  const manifest = structuredClone(validManifest());
  manifest.group.observations[0].source = 'unit-test';
  const acceptance = createTelegramWorkspaceProductionAcceptance();
  await assert.rejects(() => acceptance.verify(manifest), (error) => error.code === 'twm1.12-non-live-evidence');
});

test('TWM1.12 rejects incomplete or out-of-order acceptance evidence', async () => {
  const incomplete = structuredClone(validManifest());
  incomplete.group.observations.pop();
  const acceptance = createTelegramWorkspaceProductionAcceptance();
  await assert.rejects(() => acceptance.verify(incomplete), (error) => error.code === 'twm1.12-incomplete-scenario');

  const reordered = structuredClone(validManifest());
  const first = reordered.channel.observations[0];
  reordered.channel.observations[0] = reordered.channel.observations[1];
  reordered.channel.observations[1] = first;
  await assert.rejects(() => acceptance.verify(reordered), (error) => error.code === 'twm1.12-step-order-mismatch');
});

test('TWM1.12 rejects failed authority/rights-loss assertions instead of treating them as evidence', async () => {
  const manifest = structuredClone(validManifest());
  const index = TELEGRAM_WORKSPACE_ACCEPTANCE_SCENARIOS.group.indexOf('mutation-denied-after-rights-loss');
  manifest.group.observations[index].passed = false;
  manifest.group.observations[index].reason = 'mutation unexpectedly succeeded';
  const acceptance = createTelegramWorkspaceProductionAcceptance();
  await assert.rejects(() => acceptance.verify(manifest), (error) => error.code === 'twm1.12-step-failed');
});

test('TWM1.12 requires distinct second workspace and cross-scenario isolation', async () => {
  const noIsolation = structuredClone(validManifest());
  noIsolation.group.isolatedWorkspaceId = noIsolation.group.primaryWorkspaceId;
  noIsolation.group.observations = noIsolation.group.observations.map((entry) => ({ ...entry, workspaceId: noIsolation.group.primaryWorkspaceId }));
  const acceptance = createTelegramWorkspaceProductionAcceptance();
  await assert.rejects(() => acceptance.verify(noIsolation), (error) => error.code === 'twm1.12-isolation-evidence-missing');

  const collision = structuredClone(validManifest());
  collision.channel.primaryWorkspaceId = collision.group.primaryWorkspaceId;
  collision.channel.observations = collision.channel.observations.map((entry) => entry.workspaceId === 'tgw_channel_primary'
    ? { ...entry, workspaceId: collision.group.primaryWorkspaceId }
    : entry);
  await assert.rejects(() => acceptance.verify(collision), (error) => error.code === 'twm1.12-cross-workspace-isolation-invalid');
});

test('TWM1.12 refuses non-production or unbound acceptance claims', async () => {
  const acceptance = createTelegramWorkspaceProductionAcceptance({ revisionProvider: () => null });
  const nonProduction = structuredClone(validManifest());
  nonProduction.environment = 'test';
  await assert.rejects(() => acceptance.verify(nonProduction), (error) => error.code === 'twm1.12-production-required');

  const unbound = structuredClone(validManifest());
  delete unbound.revision;
  await assert.rejects(() => acceptance.verify(unbound), (error) => error.code === 'twm1.12-revision-required');
});
