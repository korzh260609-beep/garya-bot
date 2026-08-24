import test from 'node:test';
import assert from 'node:assert/strict';
import { createUserSettingsService } from '../src/settings/userSettingsService.js';
import { createNotificationDeliveryPolicy } from '../src/automation/notificationDeliveryPolicy.js';

const request = Object.freeze({
  kind: 'self-notification',
  actorGlobalUserId: 'user-quiet-hours',
  projectScope: 'sg2.1'
});

test('notification policy allows self notifications outside quiet hours', async () => {
  const settings = createUserSettingsService();
  await settings.update(request.actorGlobalUserId, {
    timeZone: 'Europe/Kyiv',
    notifications: { quietHours: { enabled: true, start: '22:00', end: '08:00' } }
  });
  const policy = createNotificationDeliveryPolicy({
    userSettingsService: settings,
    clock: () => new Date('2026-08-14T09:00:00.000Z')
  });
  const decision = await policy(request);
  assert.equal(decision.outcome, 'allow');
  assert.equal(decision.allowed, true);
});

test('notification policy defers during overnight quiet hours until local end', async () => {
  const settings = createUserSettingsService();
  await settings.update(request.actorGlobalUserId, {
    timeZone: 'Europe/Kyiv',
    notifications: { quietHours: { enabled: true, start: '22:00', end: '08:00' } }
  });
  const policy = createNotificationDeliveryPolicy({
    userSettingsService: settings,
    clock: () => new Date('2026-08-14T03:30:15.000Z')
  });
  const decision = await policy(request);
  assert.equal(decision.outcome, 'defer');
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'quiet-hours');
  assert.equal(decision.timeZone, 'Europe/Kyiv');
  assert.equal(decision.deferUntil, '2026-08-14T05:00:00.000Z');
});

test('explicit quiet-hours timezone overrides user timezone', async () => {
  const settings = createUserSettingsService();
  await settings.update(request.actorGlobalUserId, {
    timeZone: 'Europe/Kyiv',
    notifications: { quietHours: { enabled: true, start: '22:00', end: '08:00', timeZone: 'UTC' } }
  });
  const policy = createNotificationDeliveryPolicy({
    userSettingsService: settings,
    clock: () => new Date('2026-08-14T06:30:00.000Z')
  });
  const decision = await policy(request);
  assert.equal(decision.outcome, 'defer');
  assert.equal(decision.deferUntil, '2026-08-14T08:00:00.000Z');
  assert.equal(decision.timeZone, 'UTC');
});

test('disabled notifications are denied rather than delivered', async () => {
  const settings = createUserSettingsService();
  await settings.update(request.actorGlobalUserId, { notifications: { enabled: false } });
  const policy = createNotificationDeliveryPolicy({ userSettingsService: settings });
  const decision = await policy(request);
  assert.equal(decision.outcome, 'deny');
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'notifications-disabled');
});
