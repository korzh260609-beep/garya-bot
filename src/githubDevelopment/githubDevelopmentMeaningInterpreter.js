import { parseStructuredAIOutput } from '../ai/contracts.js';
import { createSemanticInterpretation } from '../contracts/semantic.js';

const ROUTE_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  required: ['route', 'instruction', 'target', 'confidence', 'rationale'],
  properties: {
    route: { type: 'string', enum: ['none', 'status', 'execute'] },
    instruction: { type: ['string', 'null'], maxLength: 12000 },
    target: {
      type: ['object', 'null'], additionalProperties: false,
      properties: {
        repository: { type: ['string', 'null'], maxLength: 200 },
        branch: { type: ['string', 'null'], maxLength: 300 },
        block: { type: ['string', 'null'], maxLength: 120 },
        stage: { type: ['string', 'null'], maxLength: 120 },
        scopeId: { type: ['string', 'null'], maxLength: 120 },
        paths: { type: 'array', items: { type: 'string', maxLength: 500 }, maxItems: 30 }
      }
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    rationale: { type: 'string', maxLength: 1000 }
  }
});

function conversationContext(canonicalInput) {
  const turns = canonicalInput?.metadata?.conversationContext?.recentTurns;
  if (!Array.isArray(turns)) return [];
  return turns.slice(-10).flatMap((turn) => {
    if (typeof turn?.text !== 'string' || !turn.text.trim()) return [];
    return [{ direction: turn.direction === 'outbound' ? 'assistant' : 'user', text: turn.text.slice(0, 3500) }];
  });
}

function routedInterpretation(base, route, canonicalInput) {
  const status = route.route === 'status';
  const instruction = typeof route.instruction === 'string' && route.instruction.trim() ? route.instruction.trim() : canonicalInput.text;
  return createSemanticInterpretation({
    ...base,
    goal: status ? 'inspect-github-development-availability' : 'execute-github-development',
    intent: status ? 'github-development-status' : 'github-development',
    target: route.target ?? null,
    parameters: { ...(base.parameters ?? {}), instruction },
    uncertainty: Math.max(0, Math.min(1, 1 - Number(route.confidence ?? 0))),
    missingInformation: [],
    clarificationQuestion: null,
    candidateActions: [{
      type: 'github-development',
      name: status ? 'github.repository.inspect' : 'github.development.execute',
      actionClass: status ? 'read-only' : 'state-change',
      payload: status ? { mode: 'status' } : { mode: 'execute', instruction }
    }],
    rationale: `GH3 semantic route: ${route.rationale}`
  });
}

export function createGitHubDevelopmentMeaningInterpreter({ baseInterpreter, aiRouter } = {}) {
  if (!baseInterpreter?.interpret) throw new TypeError('baseInterpreter.interpret is required');
  if (!aiRouter?.route) throw new TypeError('aiRouter.route is required');
  return Object.freeze({
    name: 'production-ai-meaning-interpreter-with-gh3',
    async interpret(canonicalInput) {
      const base = await baseInterpreter.interpret(canonicalInput);
      const result = await aiRouter.route({
        task: 'github-development-semantic-routing',
        specialty: 'semantic-interpretation',
        reason: 'Determine whether the current request is a GitHub development execution/status request, including semantic continuation',
        traceContext: canonicalInput.traceContext,
        identityContext: canonicalInput.identityContext,
        role: canonicalInput.identityContext?.roles?.[0] ?? 'guest',
        messages: [
          { role: 'system', content: 'Classify only whether the CURRENT user turn should enter SG GitHub Development Workspace. Use semantic meaning, not exact words. route=execute when the user instructs SG itself to implement, fix, edit, test, commit, push, continue or otherwise perform repository development, including short follow-ups whose development target is established by recent conversation. route=status when the user asks whether SG has GitHub/repository development access or whether that workspace is available. route=none for explanations, brainstorming, code examples, general GitHub questions, or requests not asking SG to operate a repository. Runtime — not you — determines whether credentials/authority actually exist, so never infer or claim access availability. For execute, instruction must be a concise self-contained statement of the requested repository work reconstructed from the current turn plus relevant recent context. Put only explicitly established repository, branch, block/stage identity and paths into target; use null when absent. Never resolve target authority or invent missing requirements. Return schema-valid JSON only.' },
          { role: 'user', content: JSON.stringify({ current: canonicalInput.text, scope: canonicalInput.scopeContext, recentConversation: conversationContext(canonicalInput), baseInterpretation: { meaning: base.meaning, goal: base.goal, intent: base.intent, candidateActions: base.candidateActions } }) }
        ],
        responseFormat: { name: 'github_development_semantic_route', jsonSchema: ROUTE_SCHEMA, strict: false },
        maxOutputTokens: 900,
        metadata: { semanticRouting: 'gh3', locale: canonicalInput.locale }
      });
      const route = parseStructuredAIOutput(result);
      if (!['status', 'execute'].includes(route?.route)) return base;
      return routedInterpretation(base, route, canonicalInput);
    }
  });
}
