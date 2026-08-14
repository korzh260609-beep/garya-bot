function requiredName(value) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError('adapter name must be a non-empty string');
  return value.trim();
}

export function createInterfaceRegistry(initialAdapters = []) {
  const adapters = new Map();

  function register(adapter) {
    if (!adapter || typeof adapter.receive !== 'function') throw new TypeError('adapter with receive() is required');
    const name = requiredName(adapter.name);
    if (adapters.has(name)) throw new Error(`adapter already registered: ${name}`);
    adapters.set(name, adapter);
    return adapter;
  }

  for (const adapter of initialAdapters) register(adapter);

  return Object.freeze({
    register,
    get(name) {
      const adapter = adapters.get(requiredName(name));
      if (!adapter) throw new Error(`adapter not registered: ${name}`);
      return adapter;
    },
    list() {
      return Object.freeze([...adapters.keys()].sort());
    },
    async receive(name, input) {
      return this.get(name).receive(input);
    }
  });
}
