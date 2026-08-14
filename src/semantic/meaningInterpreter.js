export function assertMeaningInterpreter(interpreter) {
  if (!interpreter || typeof interpreter.interpret !== 'function') {
    throw new TypeError('meaningInterpreter.interpret must be a function');
  }
  return interpreter;
}

export function createFixtureMeaningInterpreter(resolver) {
  if (typeof resolver !== 'function') throw new TypeError('resolver must be a function');
  return Object.freeze({
    name: 'fixture-meaning-interpreter',
    async interpret(canonicalInput) {
      return resolver(canonicalInput);
    }
  });
}
