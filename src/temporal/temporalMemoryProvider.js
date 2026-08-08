function inRange(record, range) {
  const value = record.updatedAt ?? record.createdAt ?? null;
  if (!value || !range?.utcStart) return false;
  const instant = Date.parse(value);
  const start = Date.parse(range.utcStart);
  const end = range.utcEndExclusive ? Date.parse(range.utcEndExclusive) : null;
  if (!Number.isFinite(instant) || !Number.isFinite(start)) return false;
  return instant >= start && (end == null || instant < end);
}

export function createTemporalMemoryProvider({ memoryProvider } = {}) {
  if (!memoryProvider?.query || !memoryProvider?.write) throw new TypeError('memoryProvider is required');

  return Object.freeze({
    name: `temporal:${memoryProvider.name ?? 'memory-provider'}`,
    write: (request) => memoryProvider.write(request),
    listAll: typeof memoryProvider.listAll === 'function' ? () => memoryProvider.listAll() : undefined,
    async query(request) {
      const result = await memoryProvider.query(request);
      const range = request.temporalRange ?? null;
      if (!range?.utcStart) return result;
      const records = result.records.filter((record) => inRange(record, range));
      return Object.freeze({
        records: Object.freeze(records),
        diagnostics: Object.freeze({
          ...(result.diagnostics ?? {}),
          temporalFiltered: result.records.length - records.length,
          temporalRange: Object.freeze({ utcStart: range.utcStart, utcEndExclusive: range.utcEndExclusive ?? null })
        })
      });
    }
  });
}
