import { randomUUID } from 'node:crypto';
import { parseStructuredAIOutput } from '../ai/contracts.js';

const CALLBACK_PREFIX = 'twm19|op-';
const OPERATIONS = Object.freeze([
  'content.create','content.attach-media','content.publish','content.schedule','content.cancel-schedule','media.save','media.publish',
  'poll.create','poll.close','poll.analyze','test.create','test.score','form.create','form.submit','feedback.create',
  'event.create','event.register','event.cancel-registration','event.reminder','faq.upsert','faq.resolve','onboarding.update',
  'moderation.queue','moderation.execute','case.create','case.transition','task.create','task.cancel','decision.confirm','decision.promote',
  'content-plan.create','summary.create','unanswered.update','analytics.snapshot','analytics.brief','export.create'
]);
const CONFIRMATION_REQUIRED = new Set([
  'content.publish','content.schedule','content.cancel-schedule','media.publish','poll.create','poll.close','moderation.execute',
  'case.transition','decision.confirm','decision.promote','content-plan.create','export.create'
]);
const METHOD = Object.freeze({
  'content.create':'createDraft','content.attach-media':'attachMedia','content.publish':'publishContent','content.schedule':'scheduleContent',
  'content.cancel-schedule':'cancelScheduledContent','poll.create':'createPoll','poll.close':'closePoll','poll.analyze':'analyzePollResults',
  'test.create':'createTest','test.score':'scoreTest','form.create':'createForm','form.submit':'submitForm','feedback.create':'createFeedback',
  'event.create':'createEvent','event.register':'registerEvent','event.cancel-registration':'cancelEventRegistration','event.reminder':'createEventReminder',
  'faq.upsert':'upsertFaq','faq.resolve':'resolveFaq','onboarding.update':'updateOnboarding','moderation.queue':'queueModeration',
  'moderation.execute':'executeModeration','case.create':'createCase','case.transition':'transitionCase','task.create':'createWorkspaceTask',
  'task.cancel':'cancelTask','decision.confirm':'confirmDecision','decision.promote':'promoteDecisionToSharedMemory','content-plan.create':'createContentPlan',
  'summary.create':'createSummary','unanswered.update':'markUnanswered','analytics.snapshot':'analyticsSnapshot','analytics.brief':'createOwnerBrief','export.create':'createExport'
});
const REFERENCE_DOMAINS = Object.freeze(['content','poll','test','form','event','moderation','case','task-link','decision','content-plan']);

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function messageFrom(update) { return update?.message ?? update?.edited_message ?? update?.callback_query?.message ?? null; }
function semanticText(update) {
  const message = messageFrom(update);
  if (typeof message?.text === 'string' && message.text.trim() !== '') return message.text.trim();
  if (typeof message?.caption === 'string' && message.caption.trim() !== '') return message.caption.trim();
  return '';
}
function actorFacts(update) {
  const source = update?.callback_query?.from ?? messageFrom(update)?.from;
  if (!source?.id) throw new TypeError('Telegram operations actor is required');
  const chat = update?.callback_query?.message?.chat ?? messageFrom(update)?.chat;
  return freeze({
    telegramUserId: String(source.id),
    locale: source.language_code ?? 'ru',
    chatId: String(chat?.id ?? source.id),
    chatType: chat?.type ?? 'private',
    platformFacts: freeze({
      platform: 'telegram', platformUserId: String(source.id), platformChatId: String(chat?.id ?? source.id),
      profile: freeze({ displayName: [source.first_name, source.last_name].filter(Boolean).join(' ').trim() || source.username || null, firstName: source.first_name ?? null, lastName: source.last_name ?? null, username: source.username ?? null, languageCode: source.language_code ?? null, source: 'telegram' })
    })
  });
}
function mediaFacts(update) {
  const message = messageFrom(update);
  if (!message) return null;
  if (Array.isArray(message.photo) && message.photo.length) {
    const photo = message.photo[message.photo.length - 1];
    return freeze({ mediaType: 'photo', fileId: String(photo.file_id), fileUniqueId: photo.file_unique_id ?? null, fileName: null, mimeType: 'image/jpeg', caption: message.caption ?? '', updateId: update?.update_id ?? null });
  }
  if (message.video?.file_id) return freeze({ mediaType: 'video', fileId: String(message.video.file_id), fileUniqueId: message.video.file_unique_id ?? null, fileName: message.video.file_name ?? null, mimeType: message.video.mime_type ?? 'video/mp4', caption: message.caption ?? '', updateId: update?.update_id ?? null });
  if (message.document?.file_id) return freeze({ mediaType: 'document', fileId: String(message.document.file_id), fileUniqueId: message.document.file_unique_id ?? null, fileName: message.document.file_name ?? null, mimeType: message.document.mime_type ?? null, caption: message.caption ?? '', updateId: update?.update_id ?? null });
  return null;
}
function parseArguments(value) {
  if (typeof value !== 'string' || value.length > 20_000) throw Object.assign(new Error('invalid workspace operation arguments'), { code: 'twm-operations-output-invalid' });
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw Object.assign(new Error('invalid workspace operation arguments JSON'), { code: 'twm-operations-output-invalid' }); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.getPrototypeOf(parsed) !== Object.prototype) throw Object.assign(new Error('workspace operation arguments must be an object'), { code: 'twm-operations-output-invalid' });
  return parsed;
}
function operationSchema(workspaceIds) {
  return {
    type: 'object', additionalProperties: false,
    properties: {
      kind: { type: 'string', enum: ['operation','not-twm'] },
      workspaceId: workspaceIds.length ? { anyOf: [{ type: 'string', enum: workspaceIds }, { type: 'null' }] } : { type: 'null' },
      operation: { anyOf: [{ type: 'string', enum: OPERATIONS }, { type: 'null' }] },
      argumentsJson: { anyOf: [{ type: 'string', maxLength: 20000 }, { type: 'null' }] },
      summary: { type: 'string', maxLength: 400 }
    },
    required: ['kind','workspaceId','operation','argumentsJson','summary']
  };
}
function label(row) {
  const p = row.payload ?? {};
  return p.title ?? p.question ?? p.text ?? p.message ?? p.purpose ?? row.status ?? row.domain;
}
function keyboard(token) {
  return { inline_keyboard: [[{ text: '✅ Подтвердить', callback_data: `${CALLBACK_PREFIX}confirm|${token}` }],[{ text: '❌ Отмена', callback_data: `${CALLBACK_PREFIX}cancel|${token}` }]] };
}
function safeFailureCode(error) {
  const value = typeof error?.code === 'string' && error.code.trim() ? error.code.trim() : 'twm-operation-failed';
  return /^[a-z0-9._:-]{1,80}$/i.test(value) ? value : 'twm-operation-failed';
}

export function createTelegramWorkspaceOperationsNaturalLanguageService({
  aiRouter, botClient, identityResolver, workspaceRegistry, authorityResolver, operationsService, pendingStore,
  projectScope = 'sg2.1', idFactory = () => randomUUID(), audit = async () => {}
} = {}) {
  if (typeof aiRouter?.route !== 'function') throw new TypeError('aiRouter.route is required');
  for (const method of ['sendMessage','editMessageText','answerCallbackQuery']) if (typeof botClient?.[method] !== 'function') throw new TypeError(`botClient.${method} is required`);
  if (typeof identityResolver !== 'function') throw new TypeError('identityResolver is required');
  if (typeof workspaceRegistry?.listWorkspaces !== 'function' || typeof workspaceRegistry?.resolveTelegramChatId !== 'function') throw new TypeError('workspaceRegistry is incomplete');
  if (typeof authorityResolver?.verify !== 'function') throw new TypeError('authorityResolver.verify is required');
  if (!operationsService?.core?.store) throw new TypeError('operationsService is required');
  for (const method of ['create','claim','complete','fail','cancel']) if (typeof pendingStore?.[method] !== 'function') throw new TypeError(`pendingStore.${method} is required`);
  const project = required(projectScope, 'projectScope');

  async function identify(update) {
    const facts = actorFacts(update);
    const resolution = await identityResolver(freeze({ transport: 'telegram', platformFacts: facts.platformFacts, scopeFacts: freeze({ projectId: project, groupId: ['group','supergroup'].includes(facts.chatType) ? facts.chatId : null, threadId: null }) }));
    return freeze({ ...facts, actorGlobalUserId: required(resolution?.identityContext?.globalUserId, 'resolved globalUserId') });
  }
  async function authorizedWorkspaces(actor) {
    const rows = await workspaceRegistry.listWorkspaces({ limit: 40 });
    const allowed = [];
    for (const workspace of rows) {
      try {
        const decision = await authorityResolver.verify({ workspaceId: workspace.workspaceId, telegramUserId: actor.telegramUserId, expectedGlobalUserId: actor.actorGlobalUserId, requestedAction: 'workspace:view', forceFresh: false });
        if (decision?.allowed) allowed.push(workspace);
      } catch {}
    }
    return allowed;
  }
  async function contextWorkspace(actor) {
    if (!['group','supergroup','channel'].includes(actor.chatType)) return null;
    const workspace = await workspaceRegistry.resolveTelegramChatId(actor.chatId);
    if (!workspace) return null;
    const decision = await authorityResolver.verify({ workspaceId: workspace.workspaceId, telegramUserId: actor.telegramUserId, expectedGlobalUserId: actor.actorGlobalUserId, requestedAction: 'workspace:view', forceFresh: false });
    return decision?.allowed ? workspace : null;
  }
  async function references(workspaceId) {
    const result = [];
    for (const domain of REFERENCE_DOMAINS) {
      const rows = await operationsService.core.store.listRecords({ workspaceId, domain, limit: 100 });
      for (const row of rows.slice(-20)) result.push({ domain, recordId: row.recordId, status: row.status, label: String(label(row)).slice(0, 180) });
    }
    return result;
  }
  async function interpret(update, candidates, forced, refs) {
    const text = semanticText(update);
    const media = mediaFacts(update);
    const traceId = `twmop:${idFactory()}`;
    const requestId = `twmop:${idFactory()}`;
    const result = await aiRouter.route({
      task: 'telegram-workspace-natural-language-operation',
      reason: 'twm1.14-1.15-semantic-operation-interpretation',
      specialty: 'semantic-interpretation',
      messages: [
        { role: 'system', content: 'Interpret a Telegram Workspace Manager operation by semantic meaning. Return only schema-valid JSON. Never invent workspace ids, record ids, poll/test/event identifiers, permissions, metrics, file ids, dates, or stored facts. Workspace and record references may use only the supplied candidates. argumentsJson must contain only operation arguments explicitly requested or safely implied by the selected operation. Supported meanings: content.create creates a draft only when the requested end state is saved/prepared content and not publication; content.attach-media attaches an already known media id; content.publish publishes an existing draft by contentId, or creates and publishes new text when the semantic end state requested by the user is immediate placement in the workspace, in which case argumentsJson must carry the new text instead of inventing a contentId; content.schedule schedules an existing draft by contentId, or creates and schedules new text when the semantic end state requested by the user is future publication, in which case argumentsJson must carry the new text plus only the supplied scheduling facts; content.cancel-schedule cancels it; media.save/media.publish use the actual attached Telegram media supplied separately and therefore argumentsJson must never contain fileId; poll.create creates regular poll or quiz (quiz=true with correctOptionIndex); poll.close/poll.analyze act on an existing poll; test.create/test.score; form.create/form.submit; feedback.create; event.create/register/cancel-registration/reminder; faq.upsert/faq.resolve; onboarding.update; moderation.queue/execute; case.create/transition; task.create/task.cancel are workspace operational tasks, not the user personal automation lifecycle; decision.confirm/promote; content-plan.create; summary.create; unanswered.update; analytics.snapshot/brief; export.create. Determine draft versus publication from the requested end state, not from keywords or phrasing. Never collapse an immediate new-text publication request into content.create merely because no draft exists yet. For unknown or ordinary conversation return not-twm. For dates/times preserve ISO values only when the user supplied enough temporal meaning; do not fabricate an exact time. For media.save/media.publish use mediaAvailable=true and never reproduce transport file identifiers. Never synthesize analytics values: analytics arguments are only window bounds, not metrics.' },
        { role: 'user', content: JSON.stringify({ text, forcedWorkspaceId: forced?.workspaceId ?? null, authorizedWorkspaces: candidates.map((w) => ({ workspaceId: w.workspaceId, title: w.title ?? null, username: w.username ?? null, type: w.workspaceType })), existingRecords: refs, mediaAvailable: Boolean(media), mediaType: media?.mediaType ?? null }) }
      ],
      responseFormat: { name: 'telegram_workspace_operation', strict: true, jsonSchema: operationSchema(candidates.map((w) => w.workspaceId)) },
      maxOutputTokens: 700,
      traceContext: { traceId, requestId },
      metadata: { context: { subsystem: 'telegram-workspace-manager', stage: 'twm1.14-1.15' } }
    });
    return freeze({ ...parseStructuredAIOutput(result), traceId, requestId, media });
  }
  function selectWorkspace(interpreted, candidates, forced) {
    if (forced) {
      if (interpreted.workspaceId && interpreted.workspaceId !== forced.workspaceId) throw Object.assign(new Error('cross-workspace override denied'), { code: 'twm-operations-workspace-override-denied' });
      return forced;
    }
    if (!interpreted.workspaceId) return null;
    return candidates.find((row) => row.workspaceId === interpreted.workspaceId) ?? null;
  }
  function context(actor, workspace, interpreted, confirmed = false) {
    return freeze({
      workspaceId: workspace.workspaceId,
      telegramUserId: actor.telegramUserId,
      actorGlobalUserId: actor.actorGlobalUserId,
      requestId: interpreted.requestId,
      traceId: interpreted.traceId,
      ...(confirmed ? { confirmation: freeze({ confirmed: true, requestId: interpreted.requestId }) } : {})
    });
  }
  async function execute(actor, workspace, interpreted, args, confirmed = false) {
    const ctx = context(actor, workspace, interpreted, confirmed);
    if (interpreted.operation === 'content.publish' && !args.contentId) {
      const draft = await operationsService.createDraft(ctx, { kind: 'text', text: required(args.text, 'text'), caption: args.caption ?? '', metadata: args.metadata ?? {} });
      return operationsService.publishContent(ctx, { contentId: draft.recordId });
    }
    if (interpreted.operation === 'content.schedule' && !args.contentId) {
      const draft = await operationsService.createDraft(ctx, { kind: 'text', text: required(args.text, 'text'), caption: args.caption ?? '', metadata: args.metadata ?? {} });
      return operationsService.scheduleContent(ctx, { contentId: draft.recordId, runAt: args.runAt ?? null, recurrence: args.recurrence ?? null, localTime: args.localTime ?? null });
    }
    if (interpreted.operation === 'media.save' || interpreted.operation === 'media.publish') {
      if (!interpreted.media?.fileId) throw Object.assign(new Error('Telegram media is required'), { code: 'twm-media-required' });
      const media = interpreted.media;
      const mediaArgs = { mediaType: media.mediaType, fileId: media.fileId, fileUniqueId: media.fileUniqueId, fileName: media.fileName, mimeType: media.mimeType, caption: args.caption ?? media.caption ?? '', provenance: { source: 'telegram-update', updateId: media.updateId } };
      if (interpreted.operation === 'media.publish') {
        if (typeof operationsService.publishMedia !== 'function') throw Object.assign(new Error('protected media publication operation unavailable'), { code: 'twm-media-publication-unavailable' });
        return operationsService.publishMedia(ctx, mediaArgs);
      }
      const draft = await operationsService.createDraft(ctx, { kind: media.mediaType, text: '', caption: mediaArgs.caption });
      return operationsService.attachMedia(ctx, { contentId: draft.recordId, mediaType: media.mediaType, fileId: media.fileId, fileUniqueId: media.fileUniqueId, fileName: media.fileName, mimeType: media.mimeType, provenance: mediaArgs.provenance });
    }
    const method = METHOD[interpreted.operation];
    if (!method || typeof operationsService[method] !== 'function') throw Object.assign(new Error('unsupported workspace operation'), { code: 'twm-operation-unsupported' });
    return operationsService[method](ctx, args);
  }
  async function send(update, text, replyMarkup = null) {
    const message = messageFrom(update);
    return botClient.sendMessage({ chatId: message.chat.id, text, replyToMessageId: message.message_id, replyMarkup });
  }
  function resultText(operation, result, summary) {
    if (operation === 'faq.resolve') return result?.known ? `Ответ из подтверждённого FAQ:\n${result.answer}` : 'Подтверждённого ответа в FAQ нет; нужен оператор.';
    if (operation === 'analytics.snapshot' || operation === 'analytics.brief') {
      const metrics = result?.metrics ?? result?.exact?.metrics ?? null;
      return metrics ? `Точные метрики workspace:\n${JSON.stringify(metrics, null, 2)}` : 'Точные метрики сформированы.';
    }
    if (operation === 'poll.analyze') return `Результат опроса основан на сохранённых Telegram-данных:\n${JSON.stringify(result?.snapshot ?? result, null, 2)}`;
    return `Готово: ${summary || operation}.`;
  }

  async function handleText(update) {
    const text = semanticText(update);
    if (!text || text.startsWith('/')) return freeze({ handled: false });
    const actor = await identify(update);
    const forced = await contextWorkspace(actor);
    const candidates = forced ? [forced] : await authorizedWorkspaces(actor);
    if (!candidates.length) {
      await send(update, 'У тебя нет доступного Telegram workspace с подтверждёнными текущими правами.');
      return freeze({ handled: true, outcome: 'no-authorized-workspace' });
    }
    const refs = await references(forced?.workspaceId ?? candidates[0].workspaceId);
    const interpreted = await interpret(update, candidates, forced, refs);
    if (interpreted.kind === 'not-twm' || !interpreted.operation || interpreted.argumentsJson == null) return freeze({ handled: false });
    const workspace = selectWorkspace(interpreted, candidates, forced);
    if (!workspace) {
      await send(update, 'Уточни, в какой доступной группе или канале выполнить действие.');
      return freeze({ handled: true, outcome: 'workspace-selection-required' });
    }
    const args = parseArguments(interpreted.argumentsJson);
    if (CONFIRMATION_REQUIRED.has(interpreted.operation)) {
      const pending = await pendingStore.create({
        workspaceId: workspace.workspaceId,
        actorGlobalUserId: actor.actorGlobalUserId,
        telegramUserId: actor.telegramUserId,
        requestId: interpreted.requestId,
        traceId: interpreted.traceId,
        proposal: { kind: 'workspace-operation', operation: interpreted.operation, arguments: args, summary: interpreted.summary, requestId: interpreted.requestId, traceId: interpreted.traceId, media: interpreted.media }
      });
      await send(update, `Подтвердить действие?\n\n${interpreted.summary}\nРиск: изменение Telegram workspace`, keyboard(pending.token));
      return freeze({ handled: true, outcome: 'operation-pending', operation: interpreted.operation });
    }
    const result = await execute(actor, workspace, interpreted, args, false);
    await send(update, resultText(interpreted.operation, result, interpreted.summary));
    try { await audit({ eventClass: 'telegram_workspace_operation_nl', outcome: 'success', operation: interpreted.operation, actorGlobalUserId: actor.actorGlobalUserId, workspaceId: workspace.workspaceId, traceId: interpreted.traceId, requestId: interpreted.requestId }); } catch {}
    return freeze({ handled: true, outcome: 'operation-executed', operation: interpreted.operation, result });
  }

  async function handleCallback(update) {
    const data = update?.callback_query?.data;
    if (typeof data !== 'string' || !data.startsWith(CALLBACK_PREFIX)) return freeze({ handled: false });
    const [, actionValue, token] = data.split('|');
    const action = actionValue?.startsWith('op-') ? actionValue.slice(3) : actionValue;
    if (!['confirm','cancel'].includes(action) || !token) throw Object.assign(new Error('invalid workspace operation callback'), { code: 'twm-operation-callback-invalid' });
    const actor = await identify(update);
    if (action === 'cancel') {
      const cancelled = await pendingStore.cancel({ token, actorGlobalUserId: actor.actorGlobalUserId, telegramUserId: actor.telegramUserId });
      await botClient.answerCallbackQuery({ callbackQueryId: update.callback_query.id, text: cancelled ? 'Отменено' : 'Операция недоступна' });
      return freeze({ handled: true, outcome: cancelled ? 'cancelled' : 'not-pending' });
    }
    const claimed = await pendingStore.claim({ token, actorGlobalUserId: actor.actorGlobalUserId, telegramUserId: actor.telegramUserId });
    if (!claimed || claimed.status !== 'processing' || claimed.proposal?.kind !== 'workspace-operation') {
      await botClient.answerCallbackQuery({ callbackQueryId: update.callback_query.id, text: 'Операция уже выполнена, отменена или истекла', showAlert: true });
      return freeze({ handled: true, outcome: 'not-pending' });
    }
    const workspace = await workspaceRegistry.getWorkspace(claimed.workspaceId);
    if (!workspace) {
      await pendingStore.fail(token);
      throw Object.assign(new Error('workspace no longer exists'), { code: 'twm-domain-workspace-not-found' });
    }
    const interpreted = freeze({ operation: claimed.proposal.operation, summary: claimed.proposal.summary, requestId: claimed.requestId, traceId: claimed.traceId, media: claimed.proposal.media ?? null });
    try {
      const result = await execute(actor, workspace, interpreted, claimed.proposal.arguments ?? {}, true);
      await pendingStore.complete(token);
      await botClient.answerCallbackQuery({ callbackQueryId: update.callback_query.id, text: 'Выполнено' });
      await botClient.editMessageText({ chatId: update.callback_query.message.chat.id, messageId: update.callback_query.message.message_id, text: resultText(interpreted.operation, result, interpreted.summary) });
      try { await audit({ eventClass: 'telegram_workspace_operation_nl', outcome: 'success', operation: interpreted.operation, actorGlobalUserId: actor.actorGlobalUserId, workspaceId: workspace.workspaceId, traceId: interpreted.traceId, requestId: interpreted.requestId }); } catch {}
      return freeze({ handled: true, outcome: 'operation-executed', operation: interpreted.operation, result });
    } catch (error) {
      const code = safeFailureCode(error);
      try { await pendingStore.fail(token); } catch {}
      try { await botClient.answerCallbackQuery({ callbackQueryId: update.callback_query.id, text: `Не выполнено: ${code}`, showAlert: true }); } catch {}
      try { await botClient.editMessageText({ chatId: update.callback_query.message.chat.id, messageId: update.callback_query.message.message_id, text: `Не выполнено: ${code}. Действие не подтверждено как успешно выполненное.` }); } catch {}
      try { await audit({ eventClass: 'telegram_workspace_operation_nl', outcome: 'failure', operation: interpreted.operation, actorGlobalUserId: actor.actorGlobalUserId, workspaceId: workspace.workspaceId, traceId: interpreted.traceId, requestId: interpreted.requestId, code }); } catch {}
      throw error;
    }
  }

  async function handleUpdate(update, { semanticRoute = null } = {}) {
    if (update?.callback_query) return handleCallback(update);
    if (semanticRoute?.destination && semanticRoute.destination !== 'telegram-workspace-manager') return freeze({ handled: false });
    if (semanticRoute?.workspaceOperation && semanticRoute.workspaceOperation !== 'operate') return freeze({ handled: false });
    return handleText(update);
  }

  return freeze({ handleUpdate, handleText, handleCallback });
}
