import { parseStructuredAIOutput } from './contracts.js';
import { createSemanticInterpretation } from '../contracts/semantic.js';
import { buildDefensivePromptBoundary, deterministicAiFallback } from './productionPolicy.js';

const NAMED_VALUE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['name', 'value'],
  properties: {
    name: { type: 'string', minLength: 1 },
    value: { type: 'string' },
  },
});

const CANDIDATE_ACTION_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['type', 'name', 'actionClass'],
  properties: {
    type: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    actionClass: { type: 'string', enum: ['analysis', 'external', 'state-change'] },
    payload: { type: 'object', additionalProperties: true },
  },
});

const SEMANTIC_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: [
    'meaning', 'goal', 'intent', 'entities', 'constraints', 'uncertainty',
    'missingInformation', 'clarificationQuestion', 'contextNeeds',
    'evidenceNeeds', 'candidateActions', 'rationale',
  ],
  properties: {
    meaning: { type: 'string', minLength: 1 },
    goal: { type: 'string', minLength: 1 },
    intent: { type: 'string', minLength: 1 },
    entities: { type: 'array', items: NAMED_VALUE_SCHEMA },
    constraints: { type: 'array', items: NAMED_VALUE_SCHEMA },
    uncertainty: { type: 'number', minimum: 0, maximum: 1 },
    missingInformation: { type: 'array', items: { type: 'string' } },
    clarificationQuestion: { type: ['string', 'null'] },
    contextNeeds: { type: 'array', items: { type: 'string' } },
    evidenceNeeds: { type: 'array', items: { type: 'string' } },
    candidateActions: { type: 'array', items: CANDIDATE_ACTION_SCHEMA },
    rationale: { type: ['string', 'null'] },
  },
});

function buildUserPayload(canonicalInput) {
  return Object.freeze({
    text: canonicalInput.text,
    locale: canonicalInput.locale,
    languageContext: canonicalInput.metadata?.languageContext ?? null,
    scope: canonicalInput.scopeContext,
    context: canonicalInput.metadata?.contextBundle ?? null,
    temporalContext: canonicalInput.metadata?.temporalContext ?? null,
    temporalResolution: canonicalInput.metadata?.temporalResolution ?? null,
  });
}

function createFallbackInterpretation(error, canonicalInput) {
  const fallback = deterministicAiFallback({
    code: error?.code ?? 'AI_UNAVAILABLE',
    traceId: canonicalInput.traceContext?.traceId ?? null,
  });
  return createSemanticInterpretation({
    meaning: fallback.message,
    goal: 'report-ai-unavailable',
    intent: 'answer',
    entities: [],
    constraints: [],
    uncertainty: 1,
    missingInformation: [],
    clarificationQuestion: null,
    contextNeeds: [],
    evidenceNeeds: [],
    candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }],
    rationale: `Deterministic fail-closed fallback: ${fallback.code}`,
  });
}

export function createProductionMeaningInterpreter({ aiRouter, fallbackOnFailure = false }) {
  if (!aiRouter?.route) throw new TypeError('aiRouter.route must be a function');

  return Object.freeze({
    name: 'production-ai-meaning-interpreter',
    async interpret(canonicalInput) {
      const userPayload = buildUserPayload(canonicalInput);
      const boundary = buildDefensivePromptBoundary({
        systemInstruction: 'You are the SG semantic interpreter. Return only schema-valid JSON. Interpret meaning; do not execute actions. Language Context is authoritative for SG-selected message/response language metadata but original text remains authoritative for meaning. If the user explicitly asks to make a language their ongoing preferred response language, return candidate action type/name language-preference-set with actionClass state-change and payload.language as the BCP-47 base language code; include payload.locale only if the user explicitly supplies a locale. If the user asks what their preferred language is, use language-preference-get with actionClass analysis. Ordinary one-message requests such as answer this in English remain compose-answer and must not persist a preference. Temporal Context is authoritative for current time, timezone and normalized relative dates; never recalculate or guess those values. External or state-changing requests must be candidates with actionClass external or state-change. Ask one clarification only when essential information is missing.',
        userInput: JSON.stringify(userPayload),
      });

      try {
        const result = await aiRouter.route({
          task: 'semantic-interpretation',
          specialty: 'semantic-interpretation',
          reason: 'Interpret canonical user meaning for Semantic Kernel',
          traceContext: canonicalInput.traceContext,
          identityContext: canonicalInput.identityContext,
          role: canonicalInput.identityContext?.roles?.[0] ?? 'guest',
          messages: [
            { role: 'system', content: boundary.system },
            { role: 'user', content: boundary.user },
          ],
          responseFormat: {
            name: 'semantic_interpretation',
            jsonSchema: SEMANTIC_SCHEMA,
            // candidateActions[].payload is intentionally extensible. OpenAI strict
            // Structured Outputs cannot safely express that open payload boundary,
            // so provider-side strictness is disabled while SG still performs its
            // own JSON parsing + semantic contract validation before Decision Engine.
            strict: false,
          },
          metadata: {
            locale: canonicalInput.locale,
            languageContext: canonicalInput.metadata?.languageContext ?? null,
            roles: canonicalInput.identityContext?.roles ?? [],
            context: userPayload,
          },
        });
        return createSemanticInterpretation(parseStructuredAIOutput(result));
      } catch (error) {
        if (!fallbackOnFailure) throw error;
        return createFallbackInterpretation(error, canonicalInput);
      }
    },
  });
}
