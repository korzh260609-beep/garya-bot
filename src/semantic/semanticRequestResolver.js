import { createCanonicalSemanticModel } from '../contracts/semantic.js';

const DEFAULT_ACTION = Object.freeze({ type: 'answer', name: 'compose-answer', actionClass: 'analysis' });

function finitePriority(value) {
  const priority = Number(value ?? 0);
  return Number.isFinite(priority) ? priority : 0;
}

function selectAction(interpretation) {
  if (interpretation.action) {
    return Object.freeze({ action: interpretation.action, index: -1, priority: finitePriority(interpretation.action.priority), source: 'explicit-action' });
  }
  const candidates = interpretation.candidateActions.length > 0 ? interpretation.candidateActions : [DEFAULT_ACTION];
  const selected = candidates
    .map((action, index) => ({ action, index, priority: finitePriority(action.priority) }))
    .sort((left, right) => right.priority !== left.priority ? right.priority - left.priority : left.index - right.index)[0];
  return Object.freeze({ ...selected, source: interpretation.candidateActions.length > 0 ? 'candidate-actions' : 'default-action' });
}

function inferredTimeExpression(canonicalInput, interpretation) {
  if (interpretation.timeExpression) return interpretation.timeExpression;
  const temporalResolution = canonicalInput.metadata?.temporalResolution;
  if (!temporalResolution || temporalResolution.status !== 'resolved') return null;
  return Object.freeze({
    type: 'resolved-temporal-expression',
    precision: temporalResolution.precision ?? null,
    timeZone: temporalResolution.timeZone ?? null,
    localStart: temporalResolution.localStart ?? null,
    localEndExclusive: temporalResolution.localEndExclusive ?? null,
    utcStart: temporalResolution.utcStart ?? null,
    utcEndExclusive: temporalResolution.utcEndExclusive ?? null,
    source: temporalResolution.source ?? 'temporal-context'
  });
}

function defaultClarification(locale) {
  const language = String(locale ?? 'en').trim().toLowerCase();
  if (language.startsWith('ru')) return 'Уточните, пожалуйста, что именно нужно сделать.';
  if (language.startsWith('uk')) return 'Уточніть, будь ласка, що саме потрібно зробити.';
  return 'Please clarify what exactly should be done.';
}

export function createSemanticRequestResolver({ minimumConfidence = 0.35 } = {}) {
  if (!Number.isFinite(minimumConfidence) || minimumConfidence < 0 || minimumConfidence > 1) {
    throw new TypeError('minimumConfidence must be between 0 and 1');
  }

  return Object.freeze({
    name: 'sg-semantic-request-resolver-v1',
    resolve({ canonicalInput, interpretation, interpreterName = 'anonymous' }) {
      if (!canonicalInput?.traceContext) throw new TypeError('canonicalInput.traceContext is required');
      if (!interpretation?.intent) throw new TypeError('interpretation.intent is required');

      const selected = selectAction(interpretation);
      const confidence = interpretation.confidence;
      const insufficient = confidence < minimumConfidence
        || (interpretation.missingInformation.length > 0 && Boolean(interpretation.clarificationQuestion));
      const clarificationQuestion = insufficient
        ? (interpretation.clarificationQuestion ?? defaultClarification(canonicalInput.locale))
        : interpretation.clarificationQuestion;

      return createCanonicalSemanticModel({
        resolutionStatus: insufficient ? 'clarification-required' : 'resolved',
        intent: interpretation.intent,
        goal: interpretation.goal,
        target: interpretation.target,
        action: selected.action,
        timeExpression: inferredTimeExpression(canonicalInput, interpretation),
        scope: interpretation.scope,
        parameters: interpretation.parameters,
        delivery: interpretation.delivery,
        confidence,
        missingInformation: interpretation.missingInformation,
        clarificationQuestion,
        provenance: {
          ...interpretation.provenance,
          interpreter: interpreterName,
          resolver: 'sg-semantic-request-resolver-v1',
          traceId: canonicalInput.traceContext.traceId,
          requestId: canonicalInput.traceContext.requestId,
          sourceText: canonicalInput.text
        },
        diagnostics: {
          selectedActionSource: selected.source,
          selectedCandidateIndex: selected.index,
          selectedCandidatePriority: selected.priority,
          minimumConfidence
        }
      });
    }
  });
}
