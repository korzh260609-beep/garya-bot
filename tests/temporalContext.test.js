import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryTimezoneStore } from '../src/temporal/temporalService.js';
import { createTemporalContextService } from '../src/temporal/temporalContextService.js';
import { createTemporalTaskStore } from '../src/temporal/temporalTaskStore.js';
import { createTemporalMemoryProvider } from '../src/temporal/temporalMemoryProvider.js';
import { createTemporalAwareMeaningInterpreter } from '../src/temporal/temporalMeaningInterpreter.js';
import { createInMemoryMemoryProvider } from '../src/memory/inMemoryMemoryProvider.js';
import { createInMemoryProductionTaskStore } from '../src/capability/productionCapabilities.js';
import { createCanonicalInput } from '../src/contracts/semantic.js';
import { createLocalProductionHarness } from '../src/runtime/localProductionHarness.js';

const REFERENCE = new Date('2026-08-08T13:05:00.000Z');
function serviceAt(instant = REFERENCE) { return createTemporalContextService({ clock: () => new Date(instant), timezoneStore: createInMemoryTimezoneStore() }); }
function canonical(text, globalUserId = 'user-1') {
  return createCanonicalInput({ text, locale: 'ru', identityContext: { globalUserId, platform: 'local', platformUserId: globalUserId, roles: ['monarch'], grants: [], authenticationLevel: 'verified' }, scopeContext: { userScope: globalUserId, projectScope: 'sg2.1', groupScope: null, threadScope: null, allowedCapabilities: [] }, traceContext: { traceId: 'trace-temporal', requestId: 'request-temporal', environment: 'test', revision: 'block-16.5' }, metadata: {} });
}

test('Temporal Context exposes deterministic UTC and user-local time', async () => {
  const temporal = serviceAt(); await temporal.setUserTimezone('user-1', 'Europe/Kyiv'); const context = await temporal.contextForUser('user-1');
  assert.equal(context.utc, '2026-08-08T13:05:00.000Z'); assert.equal(context.localDateTime, '2026-08-08T16:05:00'); assert.equal(context.timeZone, 'Europe/Kyiv'); assert.equal(context.offsetMinutes, 180);
});
test('same UTC instant can be different local calendar dates', () => {
  const temporal = serviceAt('2026-08-08T22:30:00.000Z'); const kyiv = temporal.contextForTimeZone('Europe/Kyiv'); const newYork = temporal.contextForTimeZone('America/New_York'); assert.equal(kyiv.localDate, '2026-08-09'); assert.equal(newYork.localDate, '2026-08-08');
});
test('Russian and Ukrainian relative days resolve against local calendar', () => {
  const temporal = serviceAt(); const yesterday = temporal.resolveExpression('вчера', { timeZone: 'Europe/Kyiv' }); const dayBefore = temporal.resolveExpression('позавчера', { timeZone: 'Europe/Kyiv' }); const tomorrow = temporal.resolveExpression('завтра', { timeZone: 'Europe/Kyiv' }); const dayAfter = temporal.resolveExpression('післязавтра', { timeZone: 'Europe/Kyiv' });
  assert.equal(yesterday.localStart, '2026-08-07T00:00:00'); assert.equal(dayBefore.localStart, '2026-08-06T00:00:00'); assert.equal(tomorrow.localStart, '2026-08-09T00:00:00'); assert.equal(dayAfter.localStart, '2026-08-10T00:00:00');
});
test('relative quantities preserve exact elapsed time for hours and local wall clock for calendar units', () => {
  const temporal = serviceAt(); const hours = temporal.resolveExpression('через 2 часа', { timeZone: 'Europe/Kyiv' }); const days = temporal.resolveExpression('через 3 дня', { timeZone: 'Europe/Kyiv' }); const ago = temporal.resolveExpression('3 дня назад', { timeZone: 'Europe/Kyiv' });
  assert.equal(hours.utcStart, '2026-08-08T15:05:00.000Z'); assert.equal(days.localStart, '2026-08-11T16:05:00'); assert.equal(ago.localStart, '2026-08-05T16:05:00');
});
test('implicit one-unit expressions such as через неделю are deterministic', () => {
  const temporal = serviceAt(); const week = temporal.resolveExpression('через неделю', { timeZone: 'Europe/Kyiv' }); const hour = temporal.resolveExpression('через час', { timeZone: 'Europe/Kyiv' }); assert.equal(week.localStart, '2026-08-15T16:05:00'); assert.equal(hour.utcStart, '2026-08-08T14:05:00.000Z'); assert.equal(week.originalExpression, 'через неделю');
});
test('one-month relative arithmetic clamps to the last valid calendar day', () => {
  const temporal = serviceAt('2026-01-31T08:00:00.000Z'); const result = temporal.resolveExpression('через месяц', { timeZone: 'Europe/Kyiv' }); assert.equal(result.localStart, '2026-02-28T10:00:00'); assert.equal(result.utcStart, '2026-02-28T08:00:00.000Z');
});
test('explicit tomorrow clock time normalizes to UTC', () => {
  const temporal = serviceAt(); const result = temporal.resolveExpression('завтра в 10:00', { timeZone: 'Europe/Kyiv' }); assert.equal(result.localStart, '2026-08-09T10:00:00'); assert.equal(result.utcStart, '2026-08-09T07:00:00.000Z'); assert.equal(result.ambiguous, false);
});
test('broad daypart remains an explicit range rather than invented timestamp', () => {
  const temporal = serviceAt(); const result = temporal.resolveExpression('завтра вечером', { timeZone: 'Europe/Kyiv' }); assert.equal(result.precision, 'daypart'); assert.equal(result.localStart, '2026-08-09T17:00:00'); assert.equal(result.localEndExclusive, '2026-08-09T22:00:00'); assert.equal(result.ambiguous, true); assert.equal(result.ambiguityReason, 'broad-daypart');
});
test('month and year boundaries are calendar-safe', () => {
  const temporal = serviceAt('2026-12-31T20:00:00.000Z'); const tomorrow = temporal.resolveExpression('завтра в 10:00', { timeZone: 'Europe/Kyiv' }); assert.equal(tomorrow.localStart, '2027-01-01T10:00:00'); const leap = temporal.resolveExpression('29.02.2028 в 12:00', { timeZone: 'Europe/Kyiv' }); assert.equal(leap.localStart, '2028-02-29T12:00:00');
});
test('DST spring gap and autumn overlap are never silently guessed', () => {
  const temporal = serviceAt('2026-03-01T12:00:00.000Z'); const gap = temporal.resolveExpression('2026-03-08 at 02:30', { timeZone: 'America/New_York' }); assert.equal(gap.ambiguous, true); assert.equal(gap.ambiguityReason, 'nonexistent-local-time-dst-gap'); assert.equal(gap.utcStart, null); const overlap = temporal.resolveExpression('2026-11-01 at 01:30', { timeZone: 'America/New_York' }); assert.equal(overlap.ambiguous, true); assert.equal(overlap.ambiguityReason, 'ambiguous-local-time-dst-overlap'); assert.ok(overlap.utcStart); assert.ok(overlap.utcEndExclusive);
});
test('same local recurring wall clock naturally changes UTC offset across DST', () => {
  const temporal = serviceAt(); const winter = temporal.resolveExpression('2026-02-01 at 09:00', { timeZone: 'America/New_York' }); const summer = temporal.resolveExpression('2026-07-01 at 09:00', { timeZone: 'America/New_York' }); assert.equal(winter.utcStart, '2026-02-01T14:00:00.000Z'); assert.equal(summer.utcStart, '2026-07-01T13:00:00.000Z'); assert.equal(winter.localStart.slice(11, 16), summer.localStart.slice(11, 16));
});
test('unknown user timezone fails visibly for relative local time', async () => {
  const temporal = serviceAt(); const result = await temporal.resolveForUser('unknown', 'завтра в 10:00'); assert.equal(result.status, 'timezone-required'); assert.equal(result.reason, 'user-timezone-unknown');
});
test('timezone belongs to global identity and is transport-independent', async () => {
  const temporal = serviceAt(); await temporal.setUserTimezone('global-42', 'Europe/Kyiv', { source: 'user-explicit' }); const one = await temporal.contextForUser('global-42'); const two = await temporal.contextForUser('global-42'); assert.equal(one.timeZone, 'Europe/Kyiv'); assert.equal(two.timeZone, 'Europe/Kyiv');
});
test('TemporalTaskStore converts relative local schedule into durable UTC instant', async () => {
  const temporal = serviceAt(); await temporal.setUserTimezone('user-1', 'Europe/Kyiv'); const store = createTemporalTaskStore({ taskStore: createInMemoryProductionTaskStore(), temporalService: temporal }); const task = await store.create({ scope: { userScope: 'user-1', projectScope: 'sg2.1', groupScope: null, threadScope: null }, input: { taskId: 'task-temporal', temporalExpression: 'завтра в 10:00', title: 'test' } }); assert.equal(task.runAt ?? task.payload.temporal?.utcInstant, '2026-08-09T07:00:00.000Z'); assert.equal(task.payload.temporal.timeZone, 'Europe/Kyiv'); assert.equal(task.payload.temporal.originalExpression, 'завтра в 10:00');
});
test('TemporalTaskStore rejects broad ambiguous schedule instead of guessing', async () => {
  const temporal = serviceAt(); await temporal.setUserTimezone('user-1', 'Europe/Kyiv'); const store = createTemporalTaskStore({ taskStore: createInMemoryProductionTaskStore(), temporalService: temporal }); await assert.rejects(() => store.create({ scope: { userScope: 'user-1', projectScope: 'sg2.1', groupScope: null, threadScope: null }, input: { temporalExpression: 'завтра вечером' } }), (error) => error?.code === 'task-time-ambiguous');
});
test('TemporalMemoryProvider filters scoped records by the same normalized range', async () => {
  let current = new Date('2026-08-07T08:00:00.000Z'); const base = createInMemoryMemoryProvider({ clock: () => new Date(current) }); const memory = createTemporalMemoryProvider({ memoryProvider: base }); const scope = { userScope: 'user-1', projectScope: 'sg2.1', groupScope: null, threadScope: null }; await memory.write({ layer: 'user-memory', key: 'old', value: 'old', scope, provenance: { sourceType: 'test', sourceId: '1' }, trust: 'confirmed', confirmed: true }); current = new Date('2026-08-08T08:00:00.000Z'); await memory.write({ layer: 'user-memory', key: 'today', value: 'today', scope, provenance: { sourceType: 'test', sourceId: '2' }, trust: 'confirmed', confirmed: true }); const result = await memory.query({ scope, layers: ['user-memory'], temporalRange: { utcStart: '2026-08-08T00:00:00.000Z', utcEndExclusive: '2026-08-09T00:00:00.000Z' } }); assert.deepEqual(result.records.map((record) => record.key), ['today']); assert.equal(result.diagnostics.temporalFiltered, 1);
});

test('TemporalAwareMeaningInterpreter enriches temporal context but delegates conversational recall routing to semantic interpreter', async () => {
  const temporal = serviceAt();
  await temporal.setUserTimezone('user-1', 'Europe/Kyiv');
  let semanticInput = null;
  const base = { name: 'semantic-router', interpret: async (input) => { semanticInput = input; return { candidateActions: [{ name: 'compose-answer' }], intent: 'conversation-history-recall' }; } };
  const interpreter = createTemporalAwareMeaningInterpreter({ baseInterpreter: base, temporalService: temporal });
  const time = await interpreter.interpret(canonical('который час?'));
  assert.equal(time.candidateActions[0].name, 'time-read');
  const recall = await interpreter.interpret(canonical('что мы обсуждали вчера?'));
  assert.equal(recall.candidateActions[0].name, 'compose-answer');
  assert.equal(recall.intent, 'conversation-history-recall');
  assert.equal(semanticInput.metadata.temporalResolution.localStart, '2026-08-07T00:00:00');
});

test('runtime answers current time from Temporal Context without AI knowledge', async () => {
  const harness = createLocalProductionHarness({ env: { SG_PERSISTENCE_MODE: 'memory', SG_AI_ENABLED: 'false' }, clock: () => new Date(REFERENCE) });
  await harness.temporalService.setUserTimezone('local:developer', 'Europe/Kyiv');
  await harness.runtime.start();
  try {
    const result = await harness.transport.send({ text: 'который час?', userId: 'developer', projectId: 'sg2.1' });
    assert.equal(result.response.status, 'success'); assert.match(result.response.message, /2026-08-08T16:05:00/); assert.match(result.response.message, /Europe\/Kyiv/);
  } finally { await harness.runtime.stop(); }
});
