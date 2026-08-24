import { createHash } from 'node:crypto';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function voterReference(pollId, answer) {
  const raw = answer?.user?.id ?? answer?.voter_chat?.id ?? null;
  if (raw == null) return null;
  return createHash('sha256').update(`${pollId}|${String(raw)}`).digest('hex');
}

function optionIds(answer) {
  if (!Array.isArray(answer?.option_ids)) return Object.freeze([]);
  const normalized = answer.option_ids.map(Number);
  if (!normalized.every((value) => Number.isSafeInteger(value) && value >= 0)) throw new TypeError('poll_answer.option_ids are invalid');
  return Object.freeze(normalized);
}

function telegramProfile(user) {
  return freeze({
    displayName: [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.username || null,
    firstName: user?.first_name ?? null,
    lastName: user?.last_name ?? null,
    username: user?.username ?? null,
    languageCode: user?.language_code ?? null,
    source: 'telegram-poll-answer'
  });
}

export function createTelegramWorkspacePollUpdateHandler({ operationsService, identityResolver = null, projectScope = 'sg2.1', observability = null } = {}) {
  if (typeof operationsService?.ingestTelegramPollUpdate !== 'function') throw new TypeError('operationsService.ingestTelegramPollUpdate is required');
  const store = operationsService?.core?.store;
  if (typeof store?.findPollByTelegramId !== 'function' || typeof store?.appendEvent !== 'function') throw new TypeError('workspace operations poll store is required');
  if (identityResolver !== null && typeof identityResolver !== 'function') throw new TypeError('identityResolver must be a function');

  async function resolveActor(pollAnswer) {
    const user = pollAnswer?.user;
    if (!user?.id || !identityResolver) return null;
    const resolution = await identityResolver(freeze({
      transport: 'telegram',
      platformFacts: freeze({
        platform: 'telegram',
        platformUserId: String(user.id),
        profile: telegramProfile(user)
      }),
      scopeFacts: freeze({ projectId: projectScope, groupId: null, threadId: null })
    }));
    return resolution?.identityContext?.globalUserId ?? null;
  }

  async function ingestPollAnswer(pollAnswer, updateId = null) {
    const telegramPollId = String(pollAnswer?.poll_id ?? '').trim();
    if (!telegramPollId) throw new TypeError('poll_answer.poll_id is required');
    const poll = await store.findPollByTelegramId(telegramPollId);
    if (!poll) return freeze({ handled: false, reason: 'unknown-poll' });
    const options = optionIds(pollAnswer);
    const voterRef = voterReference(telegramPollId, pollAnswer);
    const actorGlobalUserId = await resolveActor(pollAnswer);
    const eventKey = createHash('sha256')
      .update(['poll.answer-update', poll.workspaceId, poll.recordId, updateId ?? '', voterRef ?? 'unresolved-voter', ...options].join('|'))
      .digest('hex');
    const event = await store.appendEvent({
      workspaceId: poll.workspaceId,
      eventKey,
      eventType: 'poll.answer-update',
      recordDomain: 'poll',
      recordId: poll.recordId,
      actorGlobalUserId,
      evidence: {
        source: 'telegram-poll-answer',
        telegramPollId,
        updateId,
        optionIds: options,
        voterRef,
        identityResolved: actorGlobalUserId !== null
      }
    });
    try {
      await observability?.record?.({
        channel: 'telemetry',
        eventClass: 'audit_event',
        stage: 'telegram-workspace-poll-update',
        outcome: event.deduplicated ? 'deduplicated' : 'recorded',
        actorRef: actorGlobalUserId,
        data: { workspaceId: poll.workspaceId, pollId: poll.recordId, updateType: 'poll_answer' }
      });
    } catch {}
    return freeze({ handled: true, deduplicated: event.inserted === false || event.deduplicated === true, pollId: poll.recordId, optionIds: options });
  }

  async function handleUpdate(update, updateId = null) {
    if (update?.poll) return operationsService.ingestTelegramPollUpdate({ telegramPoll: update.poll, updateId });
    if (update?.poll_answer) return ingestPollAnswer(update.poll_answer, updateId);
    return freeze({ handled: false, reason: 'not-poll-update' });
  }

  return freeze({ handleUpdate, ingestPollAnswer });
}
