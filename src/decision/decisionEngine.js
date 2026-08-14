import { createDecisionEnvelope, createResponsePlan } from '../contracts/semantic.js';

const DEFAULT_ACTION = Object.freeze({ type: 'answer', name: 'compose-answer', actionClass: 'analysis' });

function finitePriority(value) { const priority = Number(value ?? 0); return Number.isFinite(priority) ? priority : 0; }
function evaluateCandidates(candidateActions) {
  const source = candidateActions.length > 0 ? candidateActions : [DEFAULT_ACTION];
  return Object.freeze(source.map((action, index) => Object.freeze({ action, index, priority: finitePriority(action.priority), executableIntent: action.type === 'execute', protectedIntent: action.actionClass === 'external' || action.actionClass === 'state-change' })));
}
function selectCandidate(evaluations) {
  return [...evaluations].sort((left, right) => right.priority !== left.priority ? right.priority - left.priority : left.index - right.index)[0];
}
function semanticMemoryCandidates(interpretation) { return Array.isArray(interpretation?.memoryCandidates) ? interpretation.memoryCandidates : []; }
function semanticMemoryQuery(interpretation) { return typeof interpretation?.memoryQuery === 'string' && interpretation.memoryQuery.trim() ? interpretation.memoryQuery.trim() : null; }
function canonicalizeSelectedAction(action, interpretation) {
  if (action?.type === 'answer' && action?.actionClass === 'analysis') {
    const legacyCandidates = Array.isArray(action.payload?.memoryCandidates) ? action.payload.memoryCandidates : [];
    const interpretationCandidates = semanticMemoryCandidates(interpretation);
    const candidates = interpretationCandidates.length > 0 ? interpretationCandidates : legacyCandidates;
    return Object.freeze({
      ...action,
      name: 'compose-answer',
      payload: Object.freeze({
        ...(action.payload ?? {}),
        semanticIntent: interpretation.intent,
        memoryQuery: semanticMemoryQuery(interpretation),
        conversationHistoryQuery: interpretation.conversationHistoryQuery ?? null,
        subsystemRequest: interpretation.subsystemRequest ?? null,
        memoryCandidates: Object.freeze([...candidates])
      })
    });
  }
  return Object.freeze({ ...action });
}
function classifyDecision({ interpretation, selected, uncertaintyThreshold }) {
  const hasClarificationQuestion = Boolean(interpretation.clarificationQuestion);
  if (hasClarificationQuestion && interpretation.missingInformation.length > 0) return 'clarification';
  if (hasClarificationQuestion && interpretation.uncertainty >= uncertaintyThreshold) return 'clarification';
  if (selected.protectedIntent || selected.executableIntent || selected.action.type === 'prepare') return 'prepare';
  return 'answer';
}
function answerFallback(locale) {
  const language = String(locale ?? 'en').trim().toLowerCase();
  if (language.startsWith('ru')) return 'СГ не смог сформировать разговорный ответ. Попробуйте повторить запрос.';
  if (language.startsWith('uk')) return 'СГ не зміг сформувати розмовну відповідь. Спробуйте повторити запит.';
  return 'SG could not compose a conversational answer. Please try the request again.';
}
function buildMessage({ decisionType, interpretation, selectedAction, locale }) {
  if (decisionType === 'clarification') return interpretation.clarificationQuestion;
  if (decisionType === 'prepare') return `Prepared action: ${selectedAction.name ?? selectedAction.type ?? 'requested action'}. Execution is disabled before Action Gate.`;
  return answerFallback(locale);
}
function buildRationale({ decisionType, interpretation, selected, requiresEvidence }) {
  if (interpretation.rationale) return interpretation.rationale;
  if (decisionType === 'clarification') return 'Essential information or uncertainty requires clarification.';
  if (decisionType === 'prepare') return 'The request contains executable, external or state-changing intent and is preparation-only.';
  if (requiresEvidence) return 'The request can be answered, but evidence requirements remain explicit for later processing.';
  return `Selected deterministic candidate ${selected.action.name ?? selected.action.type}.`;
}

export function createDecisionEngine({ uncertaintyThreshold = 0.65 } = {}) {
  if (!Number.isFinite(uncertaintyThreshold) || uncertaintyThreshold < 0 || uncertaintyThreshold > 1) throw new TypeError('uncertaintyThreshold must be between 0 and 1');
  return Object.freeze({
    name: 'sg-decision-engine-v1',
    decide({ canonicalInput, interpretation, interpreterName = 'anonymous' }) {
      if (!canonicalInput?.traceContext) throw new TypeError('canonicalInput.traceContext is required');
      if (typeof canonicalInput.text !== 'string' || canonicalInput.text.trim() === '') throw new TypeError('canonicalInput.text is required');
      if (!interpretation) throw new TypeError('interpretation is required');
      const evaluations = evaluateCandidates(interpretation.candidateActions);
      const selected = selectCandidate(evaluations);
      const selectedAction = canonicalizeSelectedAction(selected.action, interpretation);
      const requiresEvidence = interpretation.evidenceNeeds.length > 0;
      const decisionType = classifyDecision({ interpretation, selected, uncertaintyThreshold });
      const rationale = buildRationale({ decisionType, interpretation, selected, requiresEvidence });
      const memoryCandidates = semanticMemoryCandidates(interpretation);
      const memoryQuery = semanticMemoryQuery(interpretation);
      const missingInformationWithoutClarification = interpretation.missingInformation.length > 0 && !interpretation.clarificationQuestion;
      const decisionEnvelope = createDecisionEnvelope({
        traceId: canonicalInput.traceContext.traceId, requestId: canonicalInput.traceContext.requestId, decisionType, goal: interpretation.goal, intent: interpretation.intent, selectedAction,
        contextNeeds: interpretation.contextNeeds, evidenceNeeds: interpretation.evidenceNeeds, clarificationQuestion: decisionType === 'clarification' ? interpretation.clarificationQuestion : null, rationale,
        diagnostics: { engine: 'sg-decision-engine-v1', interpreter: interpreterName, uncertainty: interpretation.uncertainty, uncertaintyThreshold, candidateCount: evaluations.length, selectedCandidateIndex: selected.index, selectedCandidatePriority: selected.priority, requiresEvidence, executableIntent: selected.executableIntent, protectedIntent: selected.protectedIntent, conversationalAnswerCanonicalized: selected.action.type === 'answer' && selected.action.actionClass === 'analysis' && selected.action.name !== 'compose-answer', semanticMemoryQueryAvailable: Boolean(memoryQuery), semanticMemoryCandidateCount: memoryCandidates.length, semanticConversationHistoryQueryAvailable: Boolean(interpretation.conversationHistoryQuery), semanticSubsystemRequest: interpretation.subsystemRequest?.name ?? null, missingInformationWithoutClarification, semanticMeaningExposedAsResponse: false, permissionChecked: false, capabilityExecuted: false }
      });
      const responsePlan = createResponsePlan({ mode: decisionType, message: buildMessage({ decisionType, interpretation, selectedAction, locale: canonicalInput.locale }), requiresConfirmation: false, preparedAction: decisionType === 'prepare' ? selectedAction : null });
      return Object.freeze({ decisionEnvelope, responsePlan, candidateEvaluations: evaluations });
    }
  });
}
