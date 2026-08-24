function sanitize(event) {
  const clone = { ...event };
  delete clone.text;
  delete clone.messages;
  delete clone.apiKey;
  delete clone.authorization;
  return Object.freeze(clone);
}

export function createInMemoryAITelemetry() {
  const events = [];
  return Object.freeze({
    record(event) { events.push(sanitize(event)); },
    list() { return Object.freeze([...events]); },
    clear() { events.length = 0; }
  });
}
