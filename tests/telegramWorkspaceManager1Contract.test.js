import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TELEGRAM_WORKSPACE_TYPES,
  TELEGRAM_WORKSPACE_LIFECYCLE,
  TELEGRAM_WORKSPACE_ROLES,
  TELEGRAM_WORKSPACE_CONFIG_NAMESPACES,
  createTelegramWorkspace,
  migrateTelegramWorkspaceToSupergroup,
  canTransitionTelegramWorkspace,
  transitionTelegramWorkspace,
  createTelegramWorkspaceScope,
  assertTelegramWorkspaceScope,
  assertSameTelegramWorkspace,
  telegramWorkspaceConfigNamespace
} from '../src/telegramWorkspace/index.js';

const CLOCK = () => new Date('2026-08-12T09:00:00.000Z');
const ID_FACTORY = () => '12345678-1234-1234-1234-123456789abc';

function workspace(overrides = {}) {
  return createTelegramWorkspace({
    telegramChatId: '-1001234567890',
    workspaceType: 'supergroup',
    title: 'Workspace A',
    ...overrides
  }, { clock: CLOCK, idFactory: ID_FACTORY });
}

test('TWM1.1: canonical enums match the approved workspace contract', () => {
  assert.deepEqual(TELEGRAM_WORKSPACE_TYPES, ['group', 'supergroup', 'channel']);
  assert.deepEqual(TELEGRAM_WORKSPACE_LIFECYCLE, [
    'DISCOVERED', 'CONNECTED', 'CONFIGURING', 'ACTIVE', 'DEGRADED', 'DISCONNECTED', 'REVOKED'
  ]);
  assert.deepEqual(TELEGRAM_WORKSPACE_ROLES, ['OWNER', 'ADMIN', 'EDITOR', 'MODERATOR', 'VIEWER']);
  assert.deepEqual(TELEGRAM_WORKSPACE_CONFIG_NAMESPACES, [
    'general', 'responses', 'moderation', 'memory', 'ai', 'publication',
    'content', 'polls', 'media', 'automation', 'notifications', 'members'
  ]);
});

test('TWM1.1: creates immutable SG-rooted Telegram workspace identity', () => {
  const value = workspace();
  assert.equal(value.workspaceId, 'tgw_12345678123412341234123456789abc');
  assert.equal(value.platform, 'telegram');
  assert.equal(value.telegramChatId, '-1001234567890');
  assert.equal(value.workspaceType, 'supergroup');
  assert.equal(value.lifecycleState, 'DISCOVERED');
  assert.equal(value.botMembershipState, 'UNKNOWN');
  assert.equal(value.createdAt, '2026-08-12T09:00:00.000Z');
  assert.ok(Object.isFrozen(value));
});

test('TWM1.1: workspace identity is not derived from title or username', () => {
  const first = createTelegramWorkspace({
    telegramChatId: '-10',
    workspaceType: 'group',
    title: 'Same title',
    username: 'same_name'
  }, { clock: CLOCK, idFactory: () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' });
  const second = createTelegramWorkspace({
    telegramChatId: '-11',
    workspaceType: 'group',
    title: 'Same title',
    username: 'same_name'
  }, { clock: CLOCK, idFactory: () => 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' });
  assert.notEqual(first.workspaceId, second.workspaceId);
});

test('TWM1.1: rejects unsupported platform, type and malformed Telegram chat id', () => {
  assert.throws(() => workspace({ platform: 'discord' }), (error) => error.code === 'twm-workspace-platform-invalid');
  assert.throws(() => workspace({ workspaceType: 'private' }), (error) => error.code === 'twm-workspace-type-unsupported');
  assert.throws(() => workspace({ telegramChatId: 'abc' }), (error) => error.code === 'twm-workspace-contract-invalid');
});

test('TWM1.1: lifecycle transitions are explicit and revoked is terminal', () => {
  const discovered = workspace({ lifecycleState: 'DISCOVERED' });
  assert.equal(canTransitionTelegramWorkspace('DISCOVERED', 'CONNECTED'), true);
  assert.equal(canTransitionTelegramWorkspace('DISCOVERED', 'ACTIVE'), false);

  const connected = transitionTelegramWorkspace(discovered, 'CONNECTED', { at: '2026-08-12T09:01:00.000Z' });
  const active = transitionTelegramWorkspace(connected, 'ACTIVE', { at: '2026-08-12T09:02:00.000Z' });
  const revoked = transitionTelegramWorkspace(active, 'REVOKED', { at: '2026-08-12T09:03:00.000Z' });

  assert.equal(active.lifecycleState, 'ACTIVE');
  assert.equal(revoked.lifecycleState, 'REVOKED');
  assert.throws(
    () => transitionTelegramWorkspace(revoked, 'CONNECTED', { at: '2026-08-12T09:04:00.000Z' }),
    (error) => error.code === 'twm-workspace-lifecycle-transition-denied'
  );
});

test('TWM1.1: group to supergroup migration preserves canonical workspace identity', () => {
  const group = workspace({
    workspaceId: 'tgw_workspace_a_1234',
    telegramChatId: '-1234',
    workspaceType: 'group',
    lifecycleState: 'CONNECTED'
  });
  const migrated = migrateTelegramWorkspaceToSupergroup(group, {
    newTelegramChatId: '-1009876543210',
    detectedAt: '2026-08-12T09:05:00.000Z'
  });

  assert.equal(migrated.workspaceId, group.workspaceId);
  assert.equal(migrated.workspaceType, 'supergroup');
  assert.equal(migrated.telegramChatId, '-1009876543210');
  assert.deepEqual(migrated.migration, {
    kind: 'group_to_supergroup',
    fromTelegramChatId: '-1234',
    toTelegramChatId: '-1009876543210',
    detectedAt: '2026-08-12T09:05:00.000Z'
  });
});

test('TWM1.1: migration rejects non-group sources and same chat id targets', () => {
  assert.throws(
    () => migrateTelegramWorkspaceToSupergroup(workspace(), { newTelegramChatId: '-1002' }),
    (error) => error.code === 'twm-workspace-migration-invalid'
  );
  const group = workspace({ telegramChatId: '-44', workspaceType: 'group' });
  assert.throws(
    () => migrateTelegramWorkspaceToSupergroup(group, { newTelegramChatId: '-44' }),
    (error) => error.code === 'twm-workspace-migration-invalid'
  );
});

test('TWM1.1: request/action scope requires canonical global user, workspace and trace identity', () => {
  const scope = createTelegramWorkspaceScope({
    workspaceId: 'tgw_workspace_a_1234',
    globalUserId: 'usr_48cc07c069030fb3',
    traceId: 'trace-twm11-1',
    action: 'workspace.read'
  });
  assert.deepEqual(scope, {
    platform: 'telegram',
    workspaceId: 'tgw_workspace_a_1234',
    globalUserId: 'usr_48cc07c069030fb3',
    traceId: 'trace-twm11-1',
    action: 'workspace.read'
  });
  assert.equal(assertTelegramWorkspaceScope(scope, 'tgw_workspace_a_1234'), scope);
});

test('TWM1.1: cross-workspace scope fails closed', () => {
  const scope = createTelegramWorkspaceScope({
    workspaceId: 'tgw_workspace_a_1234',
    globalUserId: 'usr_a',
    traceId: 'trace-a'
  });
  assert.throws(
    () => assertTelegramWorkspaceScope(scope, 'tgw_workspace_b_1234'),
    (error) => error.code === 'twm-cross-workspace-denied'
  );

  const a = workspace({ workspaceId: 'tgw_workspace_a_1234' });
  const b = workspace({ workspaceId: 'tgw_workspace_b_1234' });
  assert.throws(() => assertSameTelegramWorkspace(a, b), (error) => error.code === 'twm-cross-workspace-denied');
});

test('TWM1.1: config namespaces are bounded and workspace-prefixed', () => {
  assert.equal(telegramWorkspaceConfigNamespace('responses'), 'workspace.responses');
  assert.equal(telegramWorkspaceConfigNamespace('polls'), 'workspace.polls');
  assert.throws(
    () => telegramWorkspaceConfigNamespace('authority'),
    (error) => error.code === 'twm-workspace-config-namespace-unsupported'
  );
});
