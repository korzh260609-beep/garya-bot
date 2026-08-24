export const AI_TASK_ASSESSMENT_SIGNALS = Object.freeze([
  'complexity',
  'reasoningDepth',
  'risk',
  'ambiguity',
  'toolDepth',
  'contextPressure',
  'evidenceSources',
  'evidenceConflict',
  'codingDebugging',
]);

function normalizedSignal(value, field) {
  if (value == null) return 0;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new TypeError(`${field} must be a number in [0,1]`);
  return number;
}

export function createTaskAssessment(signals = {}) {
  if (!signals || typeof signals !== 'object' || Array.isArray(signals)) throw new TypeError('task assessment signals must be an object');
  const unknown = Object.keys(signals).filter((key) => !AI_TASK_ASSESSMENT_SIGNALS.includes(key));
  if (unknown.length > 0) throw new TypeError(`unknown task assessment signal: ${unknown[0]}`);
  const normalized = Object.freeze(Object.fromEntries(
    AI_TASK_ASSESSMENT_SIGNALS.map((key) => [key, normalizedSignal(signals[key], `taskAssessmentSignals.${key}`)])
  ));
  return Object.freeze({
    version: 'AR2.4',
    source: 'deterministic-runtime-facts',
    signals: normalized,
    suppliedSignalCount: Object.keys(signals).length,
  });
}

export function createDeterministicTaskAssessor() {
  return Object.freeze({
    assess({ signals = {} } = {}) {
      return createTaskAssessment(signals);
    }
  });
}
