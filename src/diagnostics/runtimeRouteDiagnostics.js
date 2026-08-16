function iso(value) {
  if (value == null) return null;
  if (typeof value?.toISOString === 'function') return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function traceRevision(payload) {
  return payload?.traceContext?.revision ?? payload?.revision ?? null;
}
