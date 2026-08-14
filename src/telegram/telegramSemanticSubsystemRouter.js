import { randomUUID } from 'node:crypto';
import { parseStructuredAIOutput } from '../ai/contracts.js';

const ROUTE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['destination', 'workspaceOperation', 'reason'],
  properties: {
    destination: { type: 'string', enum: ['runtime', 'telegram-workspace-manager'] },
    workspaceOperation: { anyOf: [{ type: 'string', enum: ['configure', 'configuration-history'] }, { type: 'null' }] },
    reason: { type: 'string', minLength: 1, maxLength: 300 }
  }
});

function messageFrom(update) {
  return update?.message ?? update?.edited_message ?? null;
}

export function createTelegramSemanticSubsystemRouter({ aiRouter, idFactory = randomUUID } = {}) {
  if (typeof aiRouter?.route !== 'function') throw new TypeError('aiRouter.route is required');
  if (typeof idFactory !== 'function') throw new TypeError('idFactory must be a function');

  return Object.freeze({
    async routeUpdate(update) {
      const message = messageFrom(update);
      if (!message || typeof message.text !== 'string' || message.text.trim() === '' || message.text.trim().startsWith('/')) {
        return Object.freeze({ destination: 'runtime', workspaceOperation: null, reason: 'non-natural-language-text' });
      }
      const traceId = `telegram-semantic-route:${idFactory()}`;
      const requestId = `telegram-semantic-route:${idFactory()}`;
      const result = await aiRouter.route({
        task: 'telegram-semantic-subsystem-routing',
        specialty: 'semantic-interpretation',
        reason: 'select-required-sg-subsystem-before-specialized-routing',
        messages: [
          {
            role: 'system',
            content: 'Route the user message by semantic meaning, not by words, phrases, regex, language, or superficial topic overlap. destination=telegram-workspace-manager ONLY when the user is genuinely asking to configure a Telegram workspace/group/channel managed by SG or to inspect the configuration-change history of such a workspace. Ordinary conversation, prior-conversation recall, questions about what was discussed at a time, Memory 2.0 recall, user facts, project-development history, general Telegram questions, and all other requests MUST use destination=runtime. When destination=telegram-workspace-manager set workspaceOperation=configure or configuration-history. Otherwise workspaceOperation=null. Return only schema-valid JSON.'
          },
          { role: 'user', content: JSON.stringify({ text: message.text, chatType: message.chat?.type ?? null }) }
        ],
        responseFormat: { name: 'telegram_semantic_subsystem_route', strict: true, jsonSchema: ROUTE_SCHEMA },
        maxOutputTokens: 220,
        traceContext: { traceId, requestId },
        metadata: { context: { transport: 'telegram', stage: 'semantic-subsystem-routing' } }
      });
      const parsed = parseStructuredAIOutput(result);
      return Object.freeze({ ...parsed, traceId, requestId });
    }
  });
}
