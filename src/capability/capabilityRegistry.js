import { createCapability } from '../contracts/capability.js';

function score(capability, request) {
  if (!capability.actionClasses.includes(request.actionClass)) return null;
  if (capability.actionTypes.length > 0 && !capability.actionTypes.includes(request.actionType)) return null;
  let value = capability.priority;
  if (capability.name === request.capability) value += 1000;
  if (capability.actionTypes.includes(request.actionType)) value += 100;
  if (capability.actionClasses.includes(request.actionClass)) value += 10;
  return value;
}

export function createCapabilityRegistry({ capabilities = [] } = {}) {
  const entries = new Map();
  function validated(input) {
    const capability = input?.execute ? createCapability(input) : input;
    if (!capability?.name || typeof capability.execute !== 'function') throw new TypeError('A validated capability is required');
    return capability;
  }
  const api = {
    register(input) {
      const capability = validated(input);
      if (entries.has(capability.name)) throw new TypeError(`Capability already registered: ${capability.name}`);
      entries.set(capability.name, capability);
      return capability;
    },
    replace(input) {
      const capability = validated(input);
      if (!entries.has(capability.name)) throw new TypeError(`Capability is not registered: ${capability.name}`);
      entries.set(capability.name, capability);
      return capability;
    },
    get(name) {
      return entries.get(name) ?? null;
    },
    list() {
      return Object.freeze([...entries.values()]);
    },
    discover(actionRequest) {
      if (!actionRequest?.capability) throw new TypeError('actionRequest is required');
      const candidates = [...entries.values()]
        .map((capability, index) => ({ capability, index, score: score(capability, actionRequest) }))
        .filter((entry) => entry.score !== null)
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .map((entry) => Object.freeze({ capability: entry.capability, score: entry.score }));
      return Object.freeze(candidates);
    }
  };
  for (const capability of capabilities) api.register(capability);
  return Object.freeze(api);
}
