import { createActionRequestFromDecision } from '../contracts/action.js';

export function createActionGatePipeline({ actionGate }) {
  if (!actionGate?.evaluate) throw new TypeError('actionGate.evaluate must be a function');

  return Object.freeze({
    evaluateSemanticResult({ semanticResult, identityContext, scopeContext, overrides = {} }) {
      if (!semanticResult?.decisionEnvelope) throw new TypeError('semanticResult.decisionEnvelope is required');
      const actionRequest = createActionRequestFromDecision({
        decisionEnvelope: semanticResult.decisionEnvelope,
        identityContext,
        scopeContext,
        overrides
      });
      const gateDecision = actionGate.evaluate(actionRequest);
      return Object.freeze({ actionRequest, gateDecision });
    }
  });
}
