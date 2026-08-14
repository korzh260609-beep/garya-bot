const SECRET_KEYS = new Set([
  'authorization', 'apiKey', 'api_key', 'password', 'secret', 'token', 'accessToken', 'refreshToken', 'cookie', 'credentials'
]);

const TOKEN_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /sk-[A-Za-z0-9_-]{12,}/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g
];

function redactString(value) {
  return TOKEN_PATTERNS.reduce((current, pattern) => current.replace(pattern, '[REDACTED]'), value);
}

export function redactObservabilityData(value, { maxDepth = 8 } = {}) {
  const seen = new WeakSet();
  function walk(current, depth) {
    if (depth > maxDepth) return '[TRUNCATED]';
    if (current == null || typeof current === 'number' || typeof current === 'boolean') return current;
    if (typeof current === 'string') return redactString(current);
    if (typeof current !== 'object') return String(current);
    if (seen.has(current)) return '[CIRCULAR]';
    seen.add(current);
    if (Array.isArray(current)) return Object.freeze(current.map((entry) => walk(entry, depth + 1)));
    const output = {};
    for (const [key, entry] of Object.entries(current)) {
      output[key] = SECRET_KEYS.has(key) || SECRET_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : walk(entry, depth + 1);
    }
    return Object.freeze(output);
  }
  return walk(value, 0);
}
