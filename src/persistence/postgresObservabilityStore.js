function traceIdOf(event) {
  return event?.traceContext?.traceId ?? null;
}

export function createPostgresObservabilityStore({ observabilityRepository, retentionPolicy = () => true } = {}) {
  if (!observabilityRepository?.record) throw new TypeError('observabilityRepository.record is required');
  if (typeof retentionPolicy !== 'function') throw new TypeError('retentionPolicy must be a function');

  const channels = new Map([
    ['audit', []],
    ['telemetry', []],
    ['debug', []],
    ['error', []]
  ]);
  let pending = Promise.resolve();
  let failure = null;

  function persist(event) {
    return observabilityRepository.record({
      channel: event.channel,
      eventClass: event.eventClass,
      traceId: event.traceContext?.traceId ?? null,
      requestId: event.traceContext?.requestId ?? null,
      globalUserId: event.actorRef ?? null,
      projectScope: event.scopeRef?.projectScope ?? null,
      stage: event.stage ?? null,
      outcome: event.outcome ?? null,
      payload: event
    });
  }

  return Object.freeze({
    async start() {},
    append(event) {
      if (!channels.has(event?.channel)) throw new TypeError('validated observability event is required');
      if (!retentionPolicy(event)) return false;
      channels.get(event.channel).push(event);
      pending = pending.then(() => persist(event)).catch((error) => {
        failure = error;
      });
      return true;
    },
    list({ channel, traceId, eventClass } = {}) {
      const source = channel ? channels.get(channel) : [...channels.values()].flat();
      if (!source) throw new TypeError(`Unsupported channel: ${channel}`);
      return Object.freeze(source.filter((event) =>
        (!traceId || traceIdOf(event) === traceId)
        && (!eventClass || event.eventClass === eventClass)
      ));
    },
    clear(channel) {
      if (!channels.has(channel)) throw new TypeError(`Unsupported channel: ${channel}`);
      channels.get(channel).length = 0;
    },
    async flush() {
      await pending;
      if (failure) throw failure;
    },
    async close() {
      await this.flush();
    }
  });
}
