export function executeSafeNoop(decisionEnvelope) {
  if (!decisionEnvelope || typeof decisionEnvelope !== 'object') {
    throw new TypeError('decisionEnvelope is required');
  }

  return Object.freeze({
    capability: 'safe-noop',
    status: 'completed',
    executed: false,
    decisionType: decisionEnvelope.decisionType,
    traceId: decisionEnvelope.traceId
  });
}
