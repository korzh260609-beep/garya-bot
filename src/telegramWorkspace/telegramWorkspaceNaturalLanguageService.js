import { randomUUID } from 'node:crypto';
import { parseStructuredAIOutput } from '../ai/contracts.js';
import { createTelegramSemanticSubsystemRouter } from '../telegram/telegramSemanticSubsystemRouter.js';
import { TELEGRAM_WORKSPACE_CONFIGURATION_NAMESPACES } from './workspaceConfigurationService.js';

const CONFIG_NAMESPACES = Object.freeze([...TELEGRAM_WORKSPACE_CONFIGURATION_NAMESPACES]);
const CALLBACK_PREFIX = 'twm19|';

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
function deepMerge(base, patch) {
  const current = plainObject(base) ? structuredClone(base) : {};
  for (const [key, value] of Object.entries(patch)) current[key] = plainObject(value) && plainObject(current[key]) ? deepMerge(current[key], value) : structuredClone(value);
  return current;
}
function messageFrom(update) { return update?.message ?? update?.edited_message ?? null; }
function callbackData(update) { return update?.callback_query?.data ?? null; }
function button(text, action, token) { return { text, callback_data: `${CALLBACK_PREFIX}${action}|${token}` }; }
function keyboard(rows) { return { inline_keyboard: rows }; }
function parseConfigPatchJson(value) {
  if (typeof value !== 'string' || value.length > 16_384) throw Object.assign(new Error('invalid NL config patch JSON'), { code: 'twm19-output-invalid' });
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw Object.assign(new Error('invalid NL config patch JSON'), { code: 'twm19-output-invalid' }); }
  if (!plainObject(parsed)) throw Object.assign(new Error('NL config patch JSON must be an object'), { code: 'twm19-output-invalid' });
  return parsed;
}
function actorFacts(update) {
  const source = update?.callback_query?.from ?? messageFrom(update)?.from;
  if (!source?.id) throw new TypeError('Telegram NL actor is required');
  const chat = update?.callback_query?.message?.chat ?? messageFrom(update)?.chat;
  return freeze({
    telegramUserId: String(source.id), locale: source.language_code ?? 'ru', chatId: String(chat?.id ?? source.id), chatType: chat?.type ?? 'private',
    platformFacts: freeze({ platform: 'telegram', platformUserId: String(source.id), platformChatId: String(chat?.id ?? source.id), profile: freeze({ displayName: [source.first_name, source.last_name].filter(Boolean).join(' ').trim() || source.username || null, firstName: source.first_name ?? null, lastName: source.last_name ?? null, username: source.username ?? null, languageCode: source.language_code ?? null, source: 'telegram' }) })
  });
}
function compactWorkspace(workspace) { return freeze({ workspaceId: workspace.workspaceId, title: workspace.title ?? null, username: workspace.username ?? null, type: workspace.workspaceType, telegramChatId: workspace.telegramChatId }); }
function outputSchema(workspaceIds) {
  return {
    type: 'object', additionalProperties: false,
    properties: {
      kind: { type: 'string', enum: ['configure', 'history-query', 'not-twm'] },
      workspaceId: workspaceIds.length ? { anyOf: [{ type: 'string', enum: workspaceIds }, { type: 'null' }] } : { type: 'null' },
      namespace: { anyOf: [{ type: 'string', enum: CONFIG_NAMESPACES }, { type: 'null' }] },
      configPatchJson: { anyOf: [{ type: 'string', maxLength: 16384 }, { type: 'null' }] },
      historyPath: { anyOf: [{ type: 'string', maxLength: 128 }, { type: 'null' }] },
      summary: { type: 'string', maxLength: 300 }
    },
    required: ['kind', 'workspaceId', 'namespace', 'configPatchJson', 'historyPath', 'summary']
  };
}
function pathValue(object, path) { if (!path) return undefined; return path.split('.').reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), object); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function workspaceLabel(workspace) {
  const title = workspace.title ?? workspace.username ?? 'Telegram workspace';
  const type = workspace.workspaceType ?? 'workspace';
  return `${title} — ${type}`;
}

export function createTelegramWorkspaceNaturalLanguageService({
  aiRouter, botClient, identityResolver, workspaceRegistry, authorityResolver, configurationService, pendingStore,
  projectScope = 'sg2.1', idFactory = () => randomUUID(), audit = async () => {}
} = {}) {
  if (typeof aiRouter?.route !== 'function') throw new TypeError('aiRouter.route is required');
  for (const method of ['sendMessage', 'editMessageText', 'answerCallbackQuery']) if (typeof botClient?.[method] !== 'function') throw new TypeError(`botClient.${method} is required`);
  if (typeof identityResolver !== 'function') throw new TypeError('identityResolver is required');
  if (typeof workspaceRegistry?.listWorkspaces !== 'function' || typeof workspaceRegistry?.resolveTelegramChatId !== 'function') throw new TypeError('workspaceRegistry is incomplete');
  if (typeof authorityResolver?.verify !== 'function') throw new TypeError('authorityResolver.verify is required');
  for (const method of ['getConfig', 'proposeChange', 'applyProposal', 'history']) if (typeof configurationService?.[method] !== 'function') throw new TypeError(`configurationService.${method} is required`);
  for (const method of ['create', 'claim', 'complete', 'fail', 'cancel']) if (typeof pendingStore?.[method] !== 'function') throw new TypeError(`pendingStore.${method} is required`);
  const project = required(projectScope, 'projectScope');
  const subsystemRouter = createTelegramSemanticSubsystemRouter({ aiRouter, idFactory });

  async function identify(update) {
    const facts = actorFacts(update);
    const resolution = await identityResolver(freeze({ transport: 'telegram', platformFacts: facts.platformFacts, scopeFacts: freeze({ projectId: project, groupId: ['group', 'supergroup'].includes(facts.chatType) ? facts.chatId : null, threadId: null }) }));
    return freeze({ ...facts, actorGlobalUserId: required(resolution?.identityContext?.globalUserId, 'resolved globalUserId') });
  }

  async function authorizedWorkspaces(actor) {
    const all = await workspaceRegistry.listWorkspaces({ limit: 40 });
    const allowed = [];
    for (const workspace of all) {
      try {
        const decision = await authorityResolver.verify({ workspaceId: workspace.workspaceId, telegramUserId: actor.telegramUserId, expectedGlobalUserId: actor.actorGlobalUserId, requestedAction: 'workspace:view', forceFresh: false });
        if (decision?.allowed) allowed.push(workspace);
      } catch {}
    }
    return allowed;
  }

  async function contextWorkspace(actor) {
    if (!['group', 'supergroup', 'channel'].includes(actor.chatType)) return null;
    const workspace = await workspaceRegistry.resolveTelegramChatId(actor.chatId);
    if (!workspace) return null;
    const decision = await authorityResolver.verify({ workspaceId: workspace.workspaceId, telegramUserId: actor.telegramUserId, expectedGlobalUserId: actor.actorGlobalUserId, requestedAction: 'workspace:view', forceFresh: false });
    return decision?.allowed ? workspace : null;
  }

  async function interpret(text, candidates, forcedWorkspace, semanticRoute = null) {
    const traceId = `twm19:${idFactory()}`;
    const requestId = `twm19:${idFactory()}`;
    const expectedKind = semanticRoute?.workspaceOperation === 'configuration-history' ? 'history-query' : semanticRoute?.workspaceOperation === 'configure' ? 'configure' : null;
    const result = await aiRouter.route({
      task: 'telegram-workspace-natural-language-configuration', reason: 'twm1.9-natural-language-configuration', specialty: 'semantic-interpretation',
      messages: [
        { role: 'system', content: 'Interpret a message that has already been semantically routed to SG Telegram Workspace Manager. Return only requested JSON. Configuration requests may target only listed workspaces and managed namespaces. Never invent permissions, workspace ids, exact history, or config facts. If expectedKind is configure/history-query, preserve that routed operation unless the message cannot validly map to a managed workspace operation; only then use not-twm. If forcedWorkspaceId is set, use only that workspace. For configure, configPatchJson must contain only fields explicitly requested; omitted fields must not change. For namespace responses, mode is a strict canonical enum: mention_only means reply only when SG is directly invoked (mention, reply to SG, or supported direct invocation), all means ambient group messages may also receive replies, off means no replies. Map the user semantic intent to exactly one of mention_only/all/off; never invent aliases such as asked_only, direct_only, mentions, on, enabled, or similar. For history-query use namespace and optional dot path; configPatchJson=null.' },
        { role: 'user', content: JSON.stringify({ text, expectedKind, forcedWorkspaceId: forcedWorkspace?.workspaceId ?? null, authorizedWorkspaces: candidates.map(compactWorkspace), managedNamespaces: CONFIG_NAMESPACES, responseModes: ['mention_only', 'all', 'off'] }) }
      ],
      responseFormat: { name: 'twm19_intent', strict: true, jsonSchema: outputSchema(candidates.map((item) => item.workspaceId)) }, maxOutputTokens: 500,
      traceContext: { traceId, requestId }, metadata: { context: { subsystem: 'telegram-workspace-manager', stage: 'twm1.9' } }
    });
    const parsed = parseStructuredAIOutput(result);
    return freeze({ ...parsed, traceId, requestId });
  }

  function resolveWorkspace(interpreted, candidates, forced) {
    if (forced) {
      if (interpreted.workspaceId && interpreted.workspaceId !== forced.workspaceId) throw Object.assign(new Error('AI attempted cross-workspace override'), { code: 'twm19-workspace-override-denied' });
      return forced;
    }
    if (!interpreted.workspaceId) return null;
    return candidates.find((item) => item.workspaceId === interpreted.workspaceId) ?? null;
  }

  async function sendMessage(update, text, replyMarkup = null) {
    const message = messageFrom(update);
    return botClient.sendMessage({ chatId: message.chat.id, text, replyToMessageId: message.message_id, replyMarkup });
  }

  async function handleText(update, { semanticRoute = null } = {}) {
    const message = messageFrom(update);
    if (!message || typeof message.text !== 'string' || message.text.trim() === '' || message.text.trim().startsWith('/')) return freeze({ handled: false });
    if (semanticRoute && semanticRoute.destination !== 'telegram-workspace-manager') return freeze({ handled: false });
    const actor = await identify(update);
    const forced = await contextWorkspace(actor);
    const candidates = forced ? [forced] : await authorizedWorkspaces(actor);

    if (semanticRoute?.workspaceOperation === 'workspace-list') {
      if (candidates.length === 0) {
        await sendMessage(update, 'У тебя нет доступных Telegram workspace, подтверждённых текущими правами.');
        return freeze({ handled: true, outcome: 'workspace-list-empty' });
      }
      await sendMessage(update, `Доступные Telegram workspace:\n${candidates.map((workspace, index) => `${index + 1}. ${workspaceLabel(workspace)}`).join('\n')}`);
      return freeze({ handled: true, outcome: 'workspace-list', workspaceIds: freeze(candidates.map((workspace) => workspace.workspaceId)) });
    }

    const interpreted = await interpret(message.text, candidates, forced, semanticRoute);
    if (interpreted.kind === 'not-twm') return freeze({ handled: false });
    const workspace = resolveWorkspace(interpreted, candidates, forced);
    if (!workspace) {
      if (candidates.length === 0) return freeze({ handled: false });
      await sendMessage(update, 'Уточни, какую группу или канал нужно настроить. Открой /workspaces или назови один из доступных workspace точнее.');
      return freeze({ handled: true, outcome: 'workspace-selection-required' });
    }

    if (interpreted.kind === 'history-query') {
      if (!interpreted.namespace) throw Object.assign(new Error('history namespace missing'), { code: 'twm19-output-invalid' });
      const rows = await configurationService.history({ workspaceId: workspace.workspaceId, namespace: interpreted.namespace, actorGlobalUserId: actor.actorGlobalUserId, telegramUserId: actor.telegramUserId, limit: 50 });
      let selected = rows;
      if (interpreted.historyPath) selected = rows.filter((row) => !same(pathValue(row.previous_config, interpreted.historyPath), pathValue(row.new_config, interpreted.historyPath)));
      const latest = selected[0];
      await sendMessage(update, latest ? `Последнее изменение ${interpreted.namespace}${interpreted.historyPath ? `.${interpreted.historyPath}` : ''}: версия ${latest.version}, actor ${latest.actor_global_user_id}, ${latest.created_at}.` : 'Подходящего изменения в доступной истории не найдено.');
      return freeze({ handled: true, outcome: 'history-query' });
    }

    if (interpreted.kind !== 'configure' || !interpreted.namespace || interpreted.configPatchJson == null) throw Object.assign(new Error('invalid NL configuration output'), { code: 'twm19-output-invalid' });
    const patch = parseConfigPatchJson(interpreted.configPatchJson);
    if (interpreted.namespace === 'responses' && patch.mode !== undefined && !['mention_only', 'all', 'off'].includes(patch.mode)) {
      throw Object.assign(new Error('non-canonical response mode from NL interpretation'), { code: 'twm19-output-invalid' });
    }
    const current = await configurationService.getConfig({ workspaceId: workspace.workspaceId, namespace: interpreted.namespace, actorGlobalUserId: actor.actorGlobalUserId, telegramUserId: actor.telegramUserId });
    const nextConfig = deepMerge(current?.config ?? {}, patch);
    const proposal = await configurationService.proposeChange({ workspaceId: workspace.workspaceId, namespace: interpreted.namespace, nextConfig, actorGlobalUserId: actor.actorGlobalUserId, telegramUserId: actor.telegramUserId, traceId: interpreted.traceId, requestId: interpreted.requestId, reason: `twm1.9 natural language: ${interpreted.summary}` });
    const pending = await pendingStore.create({ workspaceId: workspace.workspaceId, actorGlobalUserId: actor.actorGlobalUserId, telegramUserId: actor.telegramUserId, requestId: proposal.requestId, traceId: proposal.traceId, proposal });
    await sendMessage(update, `Подтвердить изменение?\n\n${interpreted.summary}\nРаздел: ${proposal.namespace}\nРиск: ${proposal.risk}`, keyboard([[button('✅ Подтвердить', 'confirm', pending.token)], [button('❌ Отмена', 'cancel', pending.token)]]));
    return freeze({ handled: true, outcome: 'proposal-pending', token: pending.token });
  }

  async function handleCallback(update) {
    const data = callbackData(update);
    if (typeof data !== 'string' || !data.startsWith(CALLBACK_PREFIX)) return freeze({ handled: false });
    const [, action, token] = data.split('|');
    if (!['confirm', 'cancel'].includes(action) || !token) throw Object.assign(new Error('unsupported TWM1.9 callback'), { code: 'twm19-callback-invalid' });
    const actor = await identify(update);
    if (action === 'cancel') {
      const cancelled = await pendingStore.cancel({ token, actorGlobalUserId: actor.actorGlobalUserId, telegramUserId: actor.telegramUserId });
      await botClient.answerCallbackQuery({ callbackQueryId: update.callback_query.id, text: cancelled ? 'Отменено' : 'Операция уже недоступна' });
      return freeze({ handled: true, outcome: cancelled ? 'cancelled' : 'not-pending' });
    }
    const claimed = await pendingStore.claim({ token, actorGlobalUserId: actor.actorGlobalUserId, telegramUserId: actor.telegramUserId });
    if (!claimed || claimed.status !== 'processing') {
      await botClient.answerCallbackQuery({ callbackQueryId: update.callback_query.id, text: 'Операция уже выполнена, отменена или истекла', showAlert: true });
      return freeze({ handled: true, outcome: 'not-pending' });
    }
    try {
      const applied = await configurationService.applyProposal({ proposal: claimed.proposal, actorGlobalUserId: actor.actorGlobalUserId, telegramUserId: actor.telegramUserId, confirmation: freeze({ confirmed: true, requestId: claimed.requestId }) });
      await pendingStore.complete(token);
      await botClient.editMessageText({ chatId: update.callback_query.message.chat.id, messageId: update.callback_query.message.message_id, text: `✅ Изменение сохранено. ${claimed.proposal.namespace}: версия ${applied.config.version}.` });
      await botClient.answerCallbackQuery({ callbackQueryId: update.callback_query.id, text: 'Сохранено' });
      return freeze({ handled: true, outcome: 'applied' });
    } catch (error) { await pendingStore.fail(token); throw error; }
  }

  async function handleUpdate(update, options = {}) {
    const result = callbackData(update)?.startsWith(CALLBACK_PREFIX) ? await handleCallback(update) : await handleText(update, options);
    try { await audit(freeze({ eventClass: 'telegram_workspace_natural_language', outcome: result.handled ? result.outcome ?? 'handled' : 'pass-through' })); } catch {}
    return result;
  }

  return Object.freeze({ handleUpdate, routeUpdate: (update) => subsystemRouter.routeUpdate(update) });
}
