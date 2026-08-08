const LEVELS = new Set(['critical', 'optional']);

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function safeDetails(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Object.freeze({});
  const text = JSON.stringify(value);
  if (/(?:token|secret|password|api[_-]?key|database[_-]?url|credential)/i.test(text)) return Object.freeze({ redacted: true });
  return Object.freeze(JSON.parse(text));
}
function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => {
      const error = new Error('dependency readiness probe timed out');
      error.code = 'dependency-timeout';
      reject(error);
    }, timeoutMs))
  ]);
}

export function createDependencyReadinessService({ probes = [], timeoutMs = 1500, clock = () => new Date(), observability = null } = {}) {
  if (!Array.isArray(probes)) throw new TypeError('probes must be an array');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 30000) throw new TypeError('timeoutMs must be 10..30000');
  const registry = new Map();

  function register(probe) {
    if (!probe || typeof probe !== 'object') throw new TypeError('probe is required');
    const name = required(probe.name, 'probe.name');
    const level = probe.level ?? 'critical';
    if (!LEVELS.has(level)) throw new TypeError('probe.level must be critical or optional');
    if (typeof probe.check !== 'function') throw new TypeError('probe.check is required');
    if (registry.has(name)) throw new TypeError(`duplicate dependency probe: ${name}`);
    registry.set(name, Object.freeze({ name, level, check: probe.check }));
    return name;
  }
  for (const probe of probes) register(probe);

  async function evaluate({ traceContext = null } = {}) {
    const checkedAt = clock().toISOString();
    const results = [];
    for (const probe of registry.values()) {
      const started = Date.now();
      try {
        const raw = await withTimeout(Promise.resolve().then(() => probe.check()), timeoutMs);
        const ok = raw === true || raw?.ok === true || raw?.ready === true;
        results.push(Object.freeze({
          name: probe.name,
          level: probe.level,
          ok,
          status: ok ? 'ready' : 'not-ready',
          code: ok ? null : (raw?.code ?? 'dependency-not-ready'),
          durationMs: Date.now() - started,
          details: safeDetails(raw?.details ?? {})
        }));
      } catch (error) {
        results.push(Object.freeze({
          name: probe.name,
          level: probe.level,
          ok: false,
          status: 'error',
          code: error?.code ?? 'dependency-probe-failed',
          durationMs: Date.now() - started,
          details: Object.freeze({})
        }));
      }
    }
    const criticalFailures = results.filter((result) => result.level === 'critical' && !result.ok);
    const optionalFailures = results.filter((result) => result.level === 'optional' && !result.ok);
    const snapshot = Object.freeze({
      ready: criticalFailures.length === 0,
      degraded: optionalFailures.length > 0,
      checkedAt,
      criticalFailures: criticalFailures.length,
      optionalFailures: optionalFailures.length,
      dependencies: Object.freeze(results)
    });
    if (observability?.record) {
      await observability.record({
        eventClass: 'dependency_readiness_evaluated',
        channel: 'telemetry',
        stage: 'dependency-readiness',
        traceContext,
        outcome: snapshot.ready ? (snapshot.degraded ? 'degraded' : 'ready') : 'not-ready',
        data: {
          criticalFailures: snapshot.criticalFailures,
          optionalFailures: snapshot.optionalFailures,
          dependencies: snapshot.dependencies.map(({ name, level, ok, code, durationMs }) => ({ name, level, ok, code, durationMs }))
        }
      });
    }
    return snapshot;
  }

  return Object.freeze({ register, evaluate, list: () => Object.freeze([...registry.values()].map(({ name, level }) => Object.freeze({ name, level }))) });
}
