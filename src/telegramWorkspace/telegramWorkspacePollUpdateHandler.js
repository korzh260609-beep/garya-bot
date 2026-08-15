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

export function createTelegramWorkspacePollUpdateHandler({ operationsService, observability = null } = {}) {
  if (typeof operationsService?.ingestTelegramPollUpdate !== 'function') throw new TypeError('operationsService.ingestTelegramPollUpdate is required');
  const store = operationsService?.core?.store;
  if (typeof store?.findPollByTelegramId !== 'function' || typeof store?.appendEvent !== 'function') throw new TypeError('workspace operations poll store is required');

  async function ingestPollAnswer(pollAnswer, updateId = null) {
    const telegramPollId = String(pollAnswer?.poll_id ?? '').trim();
    if (!telegramPollId) throw new TypeError('poll_answer.poll_id is required');
    const poll = await store.findPollByTelegramId(telegramPollId);
    if (!poll) return freeze({ handled: false, reason: 'unknown-poll' });
    const options = optionIds(pollAnswer);
    const voterRef = voterReference(telegramPollId, pollAnswer);
    const eventKey = createHash('sha256')
      .update(['poll.answer-update', poll.workspaceId, poll.recordId, updateId ?? '', voterRef ?? 'anonymous', ...options].join('|'))
      .digest('hex');
    const event = await store.appendEvent({
      workspaceId: poll.workspaceId,
      eventKey,
      eventType: 'poll.answer-update',
      recordDomain: 'poll',
      recordId: poll.recordId,
      actorGlobalUserId: 'telegram:poll-answer',
      evidence: {
        source: 'telegram-poll-answer',
        telegramPollId,
        updateId,
        optionIds: options,
        voterRef
      }
    });
    return freeze({ handled: true, deduplicated: event.inserted === false || event.deduplicated === true, pollId: poll.recordId, optionIds: options });
  }

  async function handleUpdate(update, updateId = null) {
    if (update?.poll) return operationsService.ingestTelegramPollUpdate({ telegramPoll: update.poll, updateId });
    if (update?.poll_answer) return ingestPollAnswer(update.poll_answer, updateId);
    return freeze({ handled: false, reason: 'not-poll-update' });
  }

  return freeze({ handleUpdate, ingestPollAnswer });
}
