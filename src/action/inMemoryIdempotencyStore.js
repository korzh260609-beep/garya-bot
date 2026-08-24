export function createInMemoryIdempotencyStore() {
  const reservations = new Map();

  return Object.freeze({
    has(key) {
      return typeof key === 'string' && key.length > 0 && reservations.has(key);
    },
    reserve(key, metadata = {}) {
      if (typeof key !== 'string' || key.length === 0) throw new TypeError('idempotency key must be a non-empty string');
      if (reservations.has(key)) return false;
      reservations.set(key, Object.freeze({ ...metadata }));
      return true;
    },
    get(key) {
      return reservations.get(key) ?? null;
    },
    size() {
      return reservations.size;
    }
  });
}
