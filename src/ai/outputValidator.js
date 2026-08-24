import { parseStructuredAIOutput } from './contracts.js';

function finiteUnit(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new TypeError(`${field} must be between 0 and 1`);
  return number;
}

function atPath(value, path) {
  return String(path ?? '').split('.').filter(Boolean).reduce((current, key) => current?.[key], value);
}

function schemaFailures(value, schema, path = '$') {
  if (!schema || typeof schema !== 'object') return [];
  const failures = [];
  const typeMatches = schema.type == null
    || (schema.type === 'object' && value && typeof value === 'object' && !Array.isArray(value))
    || (schema.type === 'array' && Array.isArray(value))
    || (schema.type === 'string' && typeof value === 'string')
    || (schema.type === 'number' && typeof value === 'number' && Number.isFinite(value))
    || (schema.type === 'integer' && Number.isInteger(value))
    || (schema.type === 'boolean' && typeof value === 'boolean')
    || (schema.type === 'null' && value === null);
  if (!typeMatches) return [`${path}:type`];
  if (schema.enum && !schema.enum.some((entry) => Object.is(entry, value))) failures.push(`${path}:enum`);
  if (schema.type === 'object' && value && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!(key in value)) failures.push(`${path}.${key}:required`);
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in value) failures.push(...schemaFailures(value[key], child, `${path}.${key}`));
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) if (!allowed.has(key)) failures.push(`${path}.${key}:additional-property`);
    }
  }
  if (schema.type === 'array' && Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) failures.push(`${path}:min-items`);
    value.forEach((entry, index) => failures.push(...schemaFailures(entry, schema.items, `${path}[${index}]`)));
  }
  return failures;
}

function containsScalar(value, expected) {
  if (Array.isArray(value)) return value.some((entry) => containsScalar(entry, expected));
  if (value && typeof value === 'object') return Object.values(value).some((entry) => containsScalar(entry, expected));
  return String(value) === String(expected);
}

export function createDeterministicOutputValidator({ taskValidators = {} } = {}) {
  const validators = new Map(Object.entries(taskValidators));
  for (const [taskClass, validator] of validators) {
    if (typeof validator !== 'function') throw new TypeError(`task validator must be a function: ${taskClass}`);
  }
  return Object.freeze({
    validate({ request, result }) {
      const policy = request.validation ?? {};
      const schema = policy.schema ?? request.responseFormat?.jsonSchema ?? null;
      const structured = Boolean(schema || policy.requiredFields || policy.requiredIdentifiers || policy.evidencePath || policy.confidencePath);
      let output = result.text;
      const failures = [];
      const checks = [];
      if (structured) {
        try { output = parseStructuredAIOutput(result); checks.push('structured-json'); }
        catch { failures.push('invalid-structured-json'); }
      }
      if (failures.length === 0 && schema) {
        const schemaIssues = schemaFailures(output, schema);
        checks.push('schema');
        failures.push(...schemaIssues.map((issue) => `schema:${issue}`));
      }
      if (failures.length === 0) {
        for (const field of policy.requiredFields ?? []) {
          checks.push(`required-field:${field}`);
          if (atPath(output, field) == null) failures.push(`missing-required-field:${field}`);
        }
        for (const identifier of policy.requiredIdentifiers ?? []) {
          checks.push('identifier-preservation');
          if (!containsScalar(output, identifier)) failures.push(`missing-identifier:${identifier}`);
        }
        if (policy.evidencePath) {
          checks.push('evidence-presence');
          const evidence = atPath(output, policy.evidencePath);
          if (!Array.isArray(evidence) || evidence.length === 0) failures.push('missing-required-evidence');
        }
        const taskValidator = validators.get(request.routing.taskClass);
        if (taskValidator) {
          checks.push(`task-specific:${request.routing.taskClass}`);
          try {
            const taskResult = taskValidator({ output, request, result }) ?? {};
            if (taskResult.passed === false) failures.push(...(taskResult.failures ?? ['task-specific-validation-failed']));
          } catch {
            failures.push('task-specific-validator-error');
          }
        }
      }
      let confidence = Object.freeze({ supported: false, score: null, threshold: null, passed: null });
      if (policy.confidencePath) {
        const threshold = finiteUnit(policy.minimumConfidence ?? 0, 'validation.minimumConfidence');
        checks.push('confidence-threshold');
        const rawScore = atPath(output, policy.confidencePath);
        if (rawScore == null) {
          failures.push('confidence-missing');
          confidence = Object.freeze({ supported: true, score: null, threshold, passed: false });
        } else {
          const numericScore = Number(rawScore);
          if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 1) {
            failures.push('confidence-invalid');
            confidence = Object.freeze({ supported: true, score: null, threshold, passed: false });
          } else {
            const confidencePassed = numericScore >= threshold;
            if (!confidencePassed) failures.push('confidence-below-threshold');
            confidence = Object.freeze({ supported: true, score: numericScore, threshold, passed: confidencePassed });
          }
        }
      }
      const passed = failures.length === 0;
      return Object.freeze({
        version: 'AR2.8', status: passed ? 'passed' : 'failed', passed,
        checks: Object.freeze([...new Set(checks)]), failures: Object.freeze([...new Set(failures)]),
        confidence, escalationRecommended: !passed,
      });
    },
  });
}
