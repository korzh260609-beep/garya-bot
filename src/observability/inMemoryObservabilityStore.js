export function createInMemoryObservabilityStore({ retentionPolicy = () => true } = {}) {
  if (typeof retentionPolicy !== 'function') throw new TypeError('retentionPolicy must be a function');
  const channels = new Map([
    ['audit', []],
    ['telemetry', []],
    ['debug', []]
  ]);

  return Object.freeze({
    append(event) {
      if (!channels.has(event?.channel)) throw new TypeError('validated observability event is required');
      if (!retentionPolicy(event)) return false;
      channels.get(event.channel).push(event);
      return true;
    },
    list({ channel, traceId, eventClass } = {}) {
      const source = channel ? channels.get(channel) : [...channels.values()].flat();
      if (!source) throw new TypeError(`Unsupported channel: ${channel}`);
      return Object.freeze(source.filter((event) =>
        (!traceId || event.traceContext.traceId === traceId)
        && (!eventClass || event.eventClass === eventClass)
      ));
    },
    clear(channel) {
      if (!channels.has(channel)) throw new TypeError(`Unsupported channel: ${channel}`);
      channels.get(channel).length = 0;
    }
  });
}
