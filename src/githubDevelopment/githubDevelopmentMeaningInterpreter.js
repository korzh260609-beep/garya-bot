import { parseStructuredAIOutput } from '../ai/contracts.js';
import { createSemanticInterpretation } from '../contracts/semantic.js';

const ROUTE_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  required: ['route', 'instruction', 'target', 'confidence', 'rationale'],
  properties: {
    route: { type: 'string', enum: ['none', 'status', 'inspect', 'execute'] },
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
  const inspect = route.route === 'inspect';
  const instruction = typeof route.instruction === 'string' && route.instruction.trim() ? route.instruction.trim() : canonicalInput.text;
  return createSemanticInterpretation({
    ...base,
    goal: status ? 'inspect-github-development-availability' : inspect ? 'inspect-github-repository' : 'execute-github-development',
    intent: status ? 'github-development-status' : inspect ? 'github-repository-inspect' : 'github-development',
    target: route.target ?? null,
    parameters: { ...(base.parameters ?? {}), instruction },
    uncertainty: Math.max(0, Math.min(0.2, 1 - Number(route.confidence ?? 0))),
    missingInformation: [],
    clarificationQuestion: null,
    candidateActions: [{
      type: 'github-development',
      name: status || inspect ? 'github.repository.inspect' : 'github.development.execute',
      actionClass: status || inspect ? 'read-only' : 'state-change',
      payload: status ? { mode: 'status' } : inspect ? { mode: 'inspect', instruction } : { mode: 'execute', instruction }
    }],
    rationale: `GH3 semantic route: ${route.rationale}`
  });
}

function baseGitHubRoute(base, canonicalInput) {
  const action = (base?.candidateActions ?? []).find((item) => typeof item?.name === 'string' && item.name.startsWith('github.'));
  if (!action) return null;
  const mode = action.payload?.mode;
  const route = mode === 'status' ? 'status'
    : action.name === 'github.repository.inspect' || action.actionClass === 'read-only' ? 'inspect'
      : action.actionClass === 'state-change' || action.actionClass === 'external' ? 'execute' : null;
  if (!route) return null;
  return Object.freeze({
    route,
    instruction: action.payload?.instruction ?? canonicalInput.text,
    target: base.target ?? null,
    confidence: Math.max(0.8, Number(base.confidence ?? (1 - Number(base.uncertainty ?? 1)))),
    rationale: 'preserved canonical GitHub action from primary semantic interpretation'
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
        reason: 'Determine whether the current request is a GitHub repository read, development execution or runtime-status request, including semantic continuation',
        traceContext: canonicalInput.traceContext,
        identityContext: canonicalInput.identityContext,
        role: canonicalInput.identityContext?.roles?.[0] ?? 'guest',
        messages: [
          { role: 'system', content: 'Classify only whether the CURRENT user turn should enter SG GitHub Development Workspace. Use semantic meaning, not exact words. route=execute when the user instructs SG itself to implement, fix, edit, test, commit, push, continue or otherwise perform repository development, including short follow-ups whose development target is established by recent conversation. route=inspect when the user asks SG to find, read, verify, show or inspect actual repository code/files/blocks/stages/content without changing it. route=status only when the user asks whether the GitHub development connection/workspace/capability itself is available. route=none for explanations, brainstorming, code examples, general GitHub questions, or requests not asking SG to operate or inspect a repository. Runtime — not you — determines whether credentials/authority actually exist, so never infer or claim access availability. For execute or inspect, instruction must be a concise self-contained statement reconstructed from the current turn plus relevant recent context. Put only explicitly established repository, branch, block/stage identity and paths into target; use null when absent. Never resolve target authority or invent missing requirements. Return schema-valid JSON only.' },
          { role: 'user', content: JSON.stringify({ current: canonicalInput.text, scope: canonicalInput.scopeContext, recentConversation: conversationContext(canonicalInput), baseInterpretation: { meaning: base.meaning, goal: base.goal, intent: base.intent, candidateActions: base.candidateActions } }) }
        ],
        responseFormat: { name: 'github_development_semantic_route', jsonSchema: ROUTE_SCHEMA, strict: false },
        maxOutputTokens: 900,
        metadata: { semanticRouting: 'gh3', locale: canonicalInput.locale }
      });
      const route = parseStructuredAIOutput(result);
      const preserved = baseGitHubRoute(base, canonicalInput);
      if (!['status', 'inspect', 'execute'].includes(route?.route)) return preserved ? routedInterpretation(base, preserved, canonicalInput) : base;
      const normalizedRoute = {
        ...route,
        confidence: Math.max(0.8, Number(route.confidence ?? 0), preserved?.route === route.route ? preserved.confidence : 0),
        rationale: preserved?.route === route.route ? `${route.rationale}; ${preserved.rationale}` : route.rationale
      };
      return routedInterpretation(base, normalizedRoute, canonicalInput);
    }
  });
}
