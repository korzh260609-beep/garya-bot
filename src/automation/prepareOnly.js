const KINDS = Object.freeze(['code.prepare', 'pr.prepare']);

export function createPrepareOnlyCapability({ kind, prepare } = {}) {
  if (!KINDS.includes(kind)) throw new TypeError('kind must be code.prepare or pr.prepare');
  if (typeof prepare !== 'function') throw new TypeError('prepare must be a function');
  return Object.freeze({
    kind,
    actionClass: 'prepare-only',
    stateChanging: false,
    async execute(input) {
      const output = await prepare(input);
      return Object.freeze({ kind, actionClass: 'prepare-only', prepared: true, output: output ?? null });
    }
  });
}

export { KINDS as PREPARE_ONLY_KINDS };
