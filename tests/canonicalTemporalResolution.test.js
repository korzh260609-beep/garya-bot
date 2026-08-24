import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemporalContextService } from '../src/temporal/temporalContextService.js';
import { createInMemoryTimezoneStore } from '../src/temporal/temporalService.js';
import { createSemanticKernel } from '../src/semantic/semanticKernel.js';
import { createSemanticRequestResolver } from '../src/semantic/semanticRequestResolver.js';
import { createFixtureMeaningInterpreter } from '../src/semantic/meaningInterpreter.js';

function interpretation(timeExpression) {
  return {
    meaning: 'Produce a bounded report.', goal: 'report', intent: 'report',
    timeExpression, entities: [], constraints: [], uncertainty: 0,
    missingInformation: [], clarificationQuestion: null, contextNeeds: [], evidenceNeeds: [],
    candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }], rationale: null
  };
}

function input({ text = 'source wording is not parsed here', referenceInstant = '2026-08-22T08:30:00.000Z', timeZone = 'Europe/Kyiv', timezoneKnown = true } = {}) {
  return {
    text, locale: 'ru', identityContext: { globalUserId: 'user-1' }, scopeContext: { type: 'direct' },
    traceContext: { traceId: 'trace-stage-3', requestId: 'request-stage-3' },
    metadata: { temporalContext: { referenceInstant, timeZone, timezoneKnown } }
  };
}

function kernelFor(expression, referenceInstant = '2026-08-22T08:30:00.000Z') {
  const temporalService = createTemporalContextService({ clock: () => new Date(referenceInstant), timezoneStore: createInMemoryTimezoneStore() });
  return createSemanticKernel({
    meaningInterpreter: createFixtureMeaningInterpreter(() => interpretation(expression)),
    semanticRequestResolver: createSemanticRequestResolver({ temporalService })
  });
}

test('previous calendar day resolves to local midnight boundaries without reparsing source wording', async () => {
  const result = await kernelFor({ type: 'previous-calendar-day' }).process(input({ text: 'completely unrelated lexical surface' }));
  const period = result.canonicalSemanticModel.timeExpression;
  assert.equal(period.type, 'previous-calendar-day');
  assert.equal(period.localStart, '2026-08-21T00:00:00');
  assert.equal(period.localEndExclusive, '2026-08-22T00:00:00');
  assert.equal(period.utcStart, '2026-08-20T21:00:00.000Z');
  assert.equal(period.utcEndExclusive, '2026-08-21T21:00:00.000Z');
  assert.equal(period.source, 'deterministic-canonical-temporal-resolver');
  assert.equal(result.decisionEnvelope.diagnostics.canonicalSemanticModelVersion, '1.0');
});

test('rolling 24 hours is an exact elapsed interval and remains distinct across DST', async () => {
  const referenceInstant = '2026-03-30T09:00:00.000Z';
  const calendar = await kernelFor({ type: 'previous-calendar-day' }, referenceInstant).process(input({ referenceInstant }));
  const rolling = await kernelFor({ type: 'rolling-24-hours' }, referenceInstant).process(input({ referenceInstant }));
  const calendarMs = Date.parse(calendar.canonicalSemanticModel.timeExpression.utcEndExclusive) - Date.parse(calendar.canonicalSemanticModel.timeExpression.utcStart);
  const rollingMs = Date.parse(rolling.canonicalSemanticModel.timeExpression.utcEndExclusive) - Date.parse(rolling.canonicalSemanticModel.timeExpression.utcStart);
  assert.equal(calendarMs, 23 * 60 * 60 * 1000);
  assert.equal(rollingMs, 24 * 60 * 60 * 1000);
});

test('current and previous week use Monday-based local calendar boundaries', async () => {
  const current = await kernelFor({ type: 'current-week' }).process(input());
  const previous = await kernelFor({ type: 'previous-week' }).process(input());
  assert.equal(current.canonicalSemanticModel.timeExpression.localStart, '2026-08-17T00:00:00');
  assert.equal(current.canonicalSemanticModel.timeExpression.localEndExclusive, '2026-08-24T00:00:00');
  assert.equal(previous.canonicalSemanticModel.timeExpression.localStart, '2026-08-10T00:00:00');
  assert.equal(previous.canonicalSemanticModel.timeExpression.localEndExclusive, '2026-08-17T00:00:00');
});

test('custom range converts explicit local boundaries and rejects reversed ranges', async () => {
  const valid = await kernelFor({ type: 'custom-range', localStart: '2026-08-01T09:00:00', localEndExclusive: '2026-08-01T11:30:00' }).process(input());
  assert.equal(valid.canonicalSemanticModel.timeExpression.utcStart, '2026-08-01T06:00:00.000Z');
  assert.equal(valid.canonicalSemanticModel.timeExpression.utcEndExclusive, '2026-08-01T08:30:00.000Z');
  const invalid = await kernelFor({ type: 'custom-range', localStart: '2026-08-01T11:30:00', localEndExclusive: '2026-08-01T09:00:00' }).process(input());
  assert.equal(invalid.canonicalSemanticModel.resolutionStatus, 'clarification-required');
  assert.deepEqual(invalid.canonicalSemanticModel.missingInformation, ['canonical-temporal-range-invalid']);
});

test('canonical local periods fail closed when canonical timezone is unavailable', async () => {
  const result = await kernelFor({ type: 'previous-calendar-day' }).process(input({ timeZone: null, timezoneKnown: false }));
  assert.equal(result.canonicalSemanticModel.resolutionStatus, 'clarification-required');
  assert.equal(result.decisionEnvelope.decisionType, 'clarification');
  assert.deepEqual(result.canonicalSemanticModel.missingInformation, ['canonical-timezone-required']);
});
