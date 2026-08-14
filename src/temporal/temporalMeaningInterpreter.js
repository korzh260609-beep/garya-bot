import { createSemanticInterpretation } from '../contracts/semantic.js';

function normalized(text) {
  return String(text ?? '').trim().toLowerCase().replace(/ё/g, 'е').replace(/[!?;,()\[\]{}]/g, ' ').replace(/\s+/g, ' ');
}

function hasPhrase(text, phrase) {
  return ` ${normalized(text)} `.includes(` ${normalized(phrase)} `);
}

function hasAny(text, phrases) {
  return phrases.some((phrase) => hasPhrase(text, phrase));
}

function timezoneFromText(text) {
  const match = String(text ?? '').match(/(?:^|\s)([A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+)(?=$|\s|[.,!?;])/);
  return match?.[1] ?? null;
}

function asksCurrentTime(text) {
  return hasAny(text, [
    'what time', 'current time', 'time now', 'what is the time',
    'который час', 'сколько времени', 'текущее время', 'который сейчас час',
    'котра година', 'який час', 'поточний час',
    'utc', 'всемирное время', 'всемирный час', 'світовий час', 'світового часу'
  ]);
}

function asksTimezoneChange(text) {
  return hasAny(text, ['timezone', 'time zone', 'часовой пояс', 'часовый пояс', 'часовий пояс']) ? timezoneFromText(text) : null;
}

function currentTimeInterpretation(canonicalInput) {
  const temporal = canonicalInput.metadata?.temporalContext ?? {};
  const asksUtcOnly = hasAny(canonicalInput.text, ['utc', 'всемирное время', 'всемирный час', 'світовий час', 'світового часу']);
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

function timezoneChangeInterpretation(timeZone) {
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
      if (zone && temporalService.isValidTimeZone(zone)) return timezoneChangeInterpretation(zone);
      if (asksCurrentTime(enriched.text)) return currentTimeInterpretation(enriched);

      // Temporal parsing is context enrichment only. It MUST NOT decide which
      // subsystem owns a conversational recall request; that belongs to the
      // semantic interpreter. This keeps temporal expressions language- and
      // wording-independent at the routing layer.
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
