import { parseStructuredAIOutput } from './contracts.js';
import { createSemanticInterpretation } from '../contracts/semantic.js';

const SEMANTIC_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: [
    'meaning', 'goal', 'intent', 'entities', 'constraints', 'uncertainty',
    'missingInformation', 'clarificationQuestion', 'contextNeeds',
    'evidenceNeeds', 'candidateActions', 'rationale'
  ],
  properties: {
    meaning: { type: 'string', minLength: 1 },
    goal: { type: 'string', minLength: 1 },
    intent: { type: 'string', minLength: 1 },
    entities: { type: 'array', items: { type: 'object' } },
    constraints: { type: 'array', items: { type: 'object' } },
    uncertainty: { type: 'number', minimum: 0, maximum: 1 },
    missingInformation: { type: 'array', items: { type: 'string' } },
    clarificationQuestion: { type: ['string', 'null'] },
    contextNeeds: { type: 'array', items: { type: 'string' } },
    evidenceNeeds: { type: 'array', items: { type: 'string' } },
    candidateActions: { type: 'array', items: { type: 'object' } },
    rationale: { type: ['string', 'null'] }
  }
});

function buildContextSummary(bundle) {
  if (!bundle) return 'No resolved context bundle was supplied.';
  return JSON.stringify(bundle);
}

export function createProductionMeaningInterpreter({ aiRouter }) {
  if (!aiRouter?.route) throw new TypeError('aiRouter.route must be a function');

  return Object.freeze({
    name: 'production-ai-meaning-interpreter',
    async interpret(canonicalInput) {
      const result = await aiRouter.route({
        task: 'semantic-interpretation',
        specialty: 'semantic-interpretation',
        reason: 'Interpret canonical user meaning for Semantic Kernel',
        traceContext: canonicalInput.traceContext,
        messages: [
          {
            role: 'system',
            content: 'You are the SG semantic interpreter. Return only schema-valid JSON. Interpret meaning; do not execute actions. External or state-changing requests must be candidates with actionClass external or state-change. Ask one clarification only when essential information is missing.'
          },
          {
            role: 'user',
            content: JSON.stringify({
              text: canonicalInput.text,
              locale: canonicalInput.locale,
              scope: canonicalInput.scopeContext,
              context: buildContextSummary(canonicalInput.metadata.contextBundle)
            })
          }
        ],
        responseFormat: { name: 'semantic_interpretation', jsonSchema: SEMANTIC_SCHEMA },
        metadata: { locale: canonicalInput.locale }
      });

      return createSemanticInterpretation(parseStructuredAIOutput(result));
    }
  });
}
