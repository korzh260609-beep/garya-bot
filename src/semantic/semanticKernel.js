import {
  createCanonicalInput,
  createDecisionEnvelope,
  createResponsePlan,
  createSemanticInterpretation
} from '../contracts/semantic.js';
import { assertMeaningInterpreter } from './meaningInterpreter.js';

function chooseCandidateAction(interpretation) {
  const first = interpretation.candidateActions[0];
  if (first) return first;
  return Object.freeze({ type: 'answer', name: 'compose-answer', actionClass: 'analysis' });
}

function classifyDecision(interpretation, selectedAction) {
  if (interpretation.missingInformation.length > 0) return 'clarification';
  if (selectedAction.actionClass === 'external' || selectedAction.actionClass === 'state-change') return 'prepare';
  if (selectedAction.type === 'execute') return 'prepare';
  return selectedAction.type === 'prepare' ? 'prepare' : 'answer';
}

function buildMessage(decisionType, interpretation, selectedAction) {
  if (decisionType === 'clarification') return interpretation.clarificationQuestion;
  if (decisionType === 'prepare') {
    return `Prepared action: ${selectedAction.name ?? selectedAction.type ?? 'requested action'}. Execution is disabled in Semantic Kernel.`;
  }
  return interpretation.meaning;
}

export function createSemanticKernel({ meaningInterpreter }) {
  const interpreter = assertMeaningInterpreter(meaningInterpreter);

  return Object.freeze({
    async process(input) {
      const canonicalInput = createCanonicalInput(input);
      const rawInterpretation = await interpreter.interpret(canonicalInput);
      const interpretation = createSemanticInterpretation(rawInterpretation);

      if (interpretation.missingInformation.length > 0 && !interpretation.clarificationQuestion) {
        throw new TypeError('clarificationQuestion is required when essential information is missing');
      }

      const selectedAction = chooseCandidateAction(interpretation);
      const decisionType = classifyDecision(interpretation, selectedAction);
      const envelope = createDecisionEnvelope({
        traceId: canonicalInput.traceContext.traceId,
        requestId: canonicalInput.traceContext.requestId,
        decisionType,
        goal: interpretation.goal,
        intent: interpretation.intent,
        selectedAction,
        contextNeeds: interpretation.contextNeeds,
        evidenceNeeds: interpretation.evidenceNeeds,
        clarificationQuestion: decisionType === 'clarification' ? interpretation.clarificationQuestion : null,
        rationale: interpretation.rationale,
        diagnostics: {
          interpreter: interpreter.name ?? 'anonymous',
          uncertainty: interpretation.uncertainty,
          candidateCount: interpretation.candidateActions.length
        }
      });

      const responsePlan = createResponsePlan({
        mode: decisionType,
        message: buildMessage(decisionType, interpretation, selectedAction),
        requiresConfirmation: false,
        preparedAction: decisionType === 'prepare' ? selectedAction : null
      });

      return Object.freeze({ canonicalInput, interpretation, decisionEnvelope: envelope, responsePlan });
    }
  });
}
