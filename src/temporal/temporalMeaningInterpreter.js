import { createSemanticInterpretation } from '../contracts/semantic.js';

function normalized(text) {
  return String(text ?? '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

function timezoneFromText(text) {
  const match = String(text ?? '').match(/\b([A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+)\b/);
  return match?.[1] ?? null;
}

function asksCurrentTime(text) {
  const value = normalized(text);
  return /\b(what time|current time|time now|what is the time|который час|сколько времени|текущее время|который сейчас час|котра година|який час|поточний час)\b/u.test(value)
    || /\b(utc|всемирн(?:ое|ый) время|світов(?:ий|ого) час)\b/u.test(value);
}

function asksTimezoneChange(text) {
  const value = normalized(text);
  return /\b(timezone|time zone|часов(?:ой|ый) пояс|часовий пояс)\b/u.test(value) && timezoneFromText(text);
}

function currentTimeInterpretation(canonicalInput) {
  const temporal = canonicalInput.metadata?.temporalContext ?? {};
  const asksUtcOnly = /\b(utc|всемирн(?:ое|ый) время|світов(?:ий|ого) час)\b/u.test(normalized(canonicalInput.text));
  const local = temporal.timezoneKnown
    ? `Local time: ${temporal.localDateTime} (${temporal.timeZone}).`
    : 'Local time is unavailable until your timezone is known.';
  const meaning = asksUtcOnly ? `UTC time: ${temporal.utc}.` : `UTC time: ${temporal.utc}. ${local}`;
  return createSemanticInterpretation({
    meaning,
    goal: 'report-current-time',
    intent: 'time-read',
    entities: [], constraints: [], uncertainty: 0,
    missingInformation: [], clarificationQuestion: null,
    contextNeeds: [], evidenceNeeds: [],
    candidateActions: [{ type: 'time-read', name: 'time-read', actionClass: 'read-only', payload: { mode: asksUtcOnly ? 'utc' : 'both' } }],
    rationale: 'Current time is resolved deterministically by Temporal Context.'
  });
}

function timezoneChangeInterpretation(canonicalInput, timeZone) {
  return createSemanticInterpretation({
    meaning: `Set user timezone to ${timeZone}.`,
    goal: 'set-user-timezone',
    intent: 'timezone-set',
    entities: [{ name: 'timezone', value: timeZone }], constraints: [], uncertainty: 0,
    missingInformation: [], clarificationQuestion: null,
    contextNeeds: [], evidenceNeeds: [],
    candidateActions: [{ type: 'timezone-set', name: 'timezone-set', actionClass: 'state-change', payload: { timeZone } }],
    rationale: 'Timezone is an explicit user-scoped setting resolved through global identity.'
  });
}

export function createTemporalAwareMeaningInterpreter({ baseInterpreter, temporalService } = {}) {
  if (!baseInterpreter?.interpret) throw new TypeError('baseInterpreter.interpret is required');
  if (!temporalService?.enrichInput || !temporalService?.resolveForUser) throw new TypeError('temporalService is required');

  return Object.freeze({
    name: `temporal-aware:${baseInterpreter.name ?? 'meaning-interpreter'}`,
    async interpret(canonicalInput) {
      const enriched = await temporalService.enrichInput(canonicalInput);
      const zone = asksTimezoneChange(enriched.text);
      if (zone && temporalService.isValidTimeZone(zone)) return timezoneChangeInterpretation(enriched, zone);
      if (asksCurrentTime(enriched.text)) return currentTimeInterpretation(enriched);

      const resolution = await temporalService.resolveForUser(enriched.identityContext.globalUserId, enriched.text, {
        referenceInstant: enriched.metadata.temporalContext.referenceInstant
      });
      const input = Object.freeze({
        ...enriched,
        metadata: Object.freeze({ ...enriched.metadata, temporalResolution: resolution.status === 'resolved' ? resolution : null })
      });
      return baseInterpreter.interpret(input);
    }
  });
}
