import { randomUUID } from 'node:crypto';
import { parseStructuredAIOutput } from '../ai/contracts.js';

const ROUTE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['destination', 'workspaceOperation', 'directInvocation', 'reason'],
  properties: {
    destination: { type: 'string', enum: ['runtime', 'telegram-workspace-manager'] },
    workspaceOperation: { anyOf: [{ type: 'string', enum: ['configure', 'configuration-history', 'workspace-list', 'operate'] }, { type: 'null' }] },
    directInvocation: { type: 'boolean' },
    reason: { type: 'string', minLength: 1, maxLength: 300 }
  }
});

function messageFrom(update) {
  return update?.message ?? update?.edited_message ?? null;
}

function semanticText(message) {
  if (typeof message?.text === 'string' && message.text.trim() !== '') return message.text.trim();
  if (typeof message?.caption === 'string' && message.caption.trim() !== '') return message.caption.trim();
  return '';
}

export function createTelegramSemanticSubsystemRouter({ aiRouter, idFactory = randomUUID } = {}) {
  if (typeof aiRouter?.route !== 'function') throw new TypeError('aiRouter.route is required');
  if (typeof idFactory !== 'function') throw new TypeError('idFactory must be a function');

  return Object.freeze({
    async routeUpdate(update) {
      const message = messageFrom(update);
      const text = semanticText(message);
      if (!message || text === '' || text.startsWith('/')) {
        return Object.freeze({ destination: 'runtime', workspaceOperation: null, directInvocation: false, reason: 'non-natural-language-text' });
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
            content: 'Route the user message by semantic meaning, not by words, phrases, regex, language, names, aliases, or superficial topic overlap. Also classify directInvocation. directInvocation=true ONLY when the message meaningfully addresses SG/the assistant as the intended responder or asks SG/the assistant to answer, explain, remember, inspect, decide, or act. directInvocation=false for ambient conversation between group participants, statements merely about SG/the assistant, or messages whose intended responder is another participant. Do not infer direct invocation from a particular spelling, bot name, greeting, prefix, keyword, or language. Telegram @mention, reply-to-bot, and bot-command metadata are handled deterministically elsewhere; directInvocation is the semantic fallback for natural direct addressing without those metadata signals. destination=telegram-workspace-manager when the user genuinely asks SG to manage a Telegram workspace/group/channel: configure it, inspect configuration history, list managed workspaces, create/manage workspace content or media, publish/schedule workspace posts, create/manage polls or quizzes, forms, feedback, events, FAQ/onboarding, moderation/cases, workspace tasks/decisions/content plans, workspace summaries/unanswered items, or workspace analytics/exports. Use workspaceOperation=operate for those content/community/analytics actions. Use workspaceOperation=workspace-list for listing managed workspaces; configure for configuration changes; configuration-history for configuration history. Personal automation and task lifecycle requests belong to the general SG runtime: creating, listing, inspecting, changing, pausing, resuming, stopping or cancelling the user own reminders, scheduled messages or recurring automations MUST use destination=runtime. Ordinary conversation, prior-conversation recall, Memory 2.0 recall, user facts, project-development history, general Telegram questions, personal automation lifecycle, and all other requests MUST use destination=runtime. Otherwise workspaceOperation=null. Return only schema-valid JSON.'
          },
          { role: 'user', content: JSON.stringify({ text, chatType: message.chat?.type ?? null, hasPhoto: Array.isArray(message.photo) && message.photo.length > 0, hasVideo: Boolean(message.video), hasDocument: Boolean(message.document) }) }
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
