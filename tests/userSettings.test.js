import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryUserSettingsStore, createUserSettingsService } from '../src/settings/userSettingsService.js';
import { createLanguageSettingsAdapter, createTimezoneSettingsAdapter } from '../src/settings/userSettingsAdapters.js';
import { createUserSettingsCapabilities } from '../src/settings/userSettingsCapabilities.js';
import { createLanguageContextService } from '../src/language/languageContextService.js';
import { createTemporalContextService } from '../src/temporal/temporalContextService.js';
import { createLocalProductionHarness } from '../src/runtime/localProductionHarness.js';

test('canonical settings expose deterministic defaults', async () => {
  const service = createUserSettingsService();
  const resolved = await service.resolve('user-1');
  assert.equal(resolved.settings.response.mode, 'normal');
  assert.equal(resolved.settings.units.system, 'metric');
  assert.equal(resolved.settings.notifications.enabled, true);
  assert.equal(resolved.provenance['response.mode'].source, 'default');
});

test('explicit settings override transport hints and inferred updates cannot overwrite explicit values', async () => {
  const service = createUserSettingsService();
  await service.update('user-1', { locale: 'uk-UA', response: { mode: 'short' } }, { source: 'explicit-user-setting' });
  await service.update('user-1', { locale: 'pl-PL', response: { mode: 'long' } }, { source: 'inference', inferred: true });
  const resolved = await service.resolve('user-1', { hints: { locale: 'de-DE' } });
  assert.equal(resolved.settings.locale, 'uk-UA');
  assert.equal(resolved.settings.response.mode, 'short');
  assert.equal(resolved.provenance.locale.explicit, true);
  assert.equal(resolved.provenance['response.mode'].explicit, true);
});

test('project overrides are isolated and do not modify global preferences', async () => {
  const service = createUserSettingsService();
  await service.update('user-1', { response: { mode: 'short' }, units: { system: 'metric' } });
  await service.update('user-1', { response: { mode: 'long' } }, { projectScope: 'project-a' });
  const global = await service.resolve('user-1');
  const projectA = await service.resolve('user-1', { projectScope: 'project-a' });
  const projectB = await service.resolve('user-1', { projectScope: 'project-b' });
  assert.equal(global.settings.response.mode, 'short');
  assert.equal(projectA.settings.response.mode, 'long');
  assert.equal(projectA.settings.units.system, 'metric');
  assert.equal(projectB.settings.response.mode, 'short');
});

test('different global users never share settings', async () => {
  const store = createInMemoryUserSettingsStore();
  const service = createUserSettingsService({ store });
  await service.update('user-a', { language: 'uk', timeZone: 'Europe/Kyiv' });
  await service.update('user-b', { language: 'pl', timeZone: 'Europe/Warsaw' });
  assert.equal((await service.resolve('user-a')).settings.language, 'uk');
  assert.equal((await service.resolve('user-b')).settings.language, 'pl');
  assert.equal((await service.resolve('user-a')).settings.timeZone, 'Europe/Kyiv');
  assert.equal((await service.resolve('user-b')).settings.timeZone, 'Europe/Warsaw');
});

test('preferences cannot request unsafe autonomy or bypass confirmation policy', async () => {
  const service = createUserSettingsService();
  await assert.rejects(() => service.update('user-1', { autonomy: { level: 'full' } }), /unsupported value/);
  await assert.rejects(() => service.update('user-1', { autonomy: { confirmation: 'never' } }), /unsupported value/);
  const resolved = await service.resolve('user-1');
  assert.equal(resolved.settings.autonomy.level, 'standard');
  assert.equal(resolved.settings.autonomy.confirmation, 'policy');
});

test('language and timezone converge on the shared settings boundary', async () => {
  const settingsService = createUserSettingsService();
  const languageContextService = createLanguageContextService({ store: createLanguageSettingsAdapter({ userSettingsService: settingsService }) });
  const temporalService = createTemporalContextService({ timezoneStore: createTimezoneSettingsAdapter({ userSettingsService: settingsService }) });
  await languageContextService.setPreferred('user-1', 'uk', { locale: 'uk-UA' });
  await temporalService.setUserTimezone('user-1', 'Europe/Kyiv');
  const resolved = await settingsService.resolve('user-1');
  assert.equal(resolved.settings.language, 'uk');
  assert.equal(resolved.settings.locale, 'uk-UA');
  assert.equal(resolved.settings.timeZone, 'Europe/Kyiv');
  assert.equal((await languageContextService.getPreferred('user-1')).language, 'uk');
  assert.equal((await temporalService.getUserTimezone('user-1')).timeZone, 'Europe/Kyiv');
});

test('user settings capabilities provide scoped read and write contracts', async () => {
  const service = createUserSettingsService();
  const capabilities = createUserSettingsCapabilities({ userSettingsService: service });
  assert.deepEqual(capabilities.map((item) => item.name), ['user-settings-get', 'user-settings-set']);
  assert.equal(capabilities[0].actionClasses.includes('read-only'), true);
  assert.equal(capabilities[1].actionClasses.includes('state-changing'), true);
  const request = { input: { settings: { response: { mode: 'short' }, units: { system: 'metric' } } }, actor: { globalUserId: 'user-1' }, scope: { projectScope: 'sg2.1' }, traceContext: { traceId: 't', requestId: 'r' } };
  const setResult = await capabilities[1].execute(request);
  assert.equal(setResult.data.settings.settings.response.mode, 'short');
  const getResult = await capabilities[0].execute({ ...request, input: {} });
  assert.equal(getResult.data.settings.settings.response.mode, 'short');
});

test('runtime resolves settings before semantic processing and exposes only presentation preferences to execution payload', async () => {
  let seenInput = null;
  let selectedPayload = null;
  const harness = createLocalProductionHarness({
    interpretationResolver: (input) => {
      seenInput = input;
      return { meaning: `Echo: ${input.text}`, goal: 'respond', intent: 'answer', entities: [], constraints: [], uncertainty: 0, missingInformation: [], clarificationQuestion: null, contextNeeds: [], evidenceNeeds: [], candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }], rationale: 'fixture' };
    }
  });
  await harness.userSettingsService.update('local:gary', { response: { mode: 'short' }, units: { system: 'metric' }, delivery: { preferredTransport: 'telegram' } });
  const originalExecute = harness.capabilities.find((item) => item.name === 'compose-answer').execute;
  void originalExecute;
  await harness.runtime.start();
  try {
    const result = await harness.transport.send({ text: 'Hello there', locale: 'en-US', userId: 'gary', projectId: 'sg2.1' });
    assert.equal(seenInput.metadata.userSettingsContext.settings.response.mode, 'short');
    selectedPayload = result.response.data.execution?.data ?? null;
    assert.equal(result.response.status, 'success');
    assert.equal(seenInput.metadata.userSettingsContext.settings.delivery.preferredTransport, 'telegram');
  } finally {
    await harness.runtime.stop();
  }
  void selectedPayload;
});
