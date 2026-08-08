import { randomUUID } from 'node:crypto';

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function optional(value) { return value == null || String(value).trim() === '' ? null : String(value).trim(); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function safeObject(value = {}, name = 'metadata') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return Object.freeze(clone(value));
}
function normalizeScope({ globalUserId, projectScope, groupScope = null, threadScope = null } = {}) {
  const scope = { globalUserId: required(globalUserId, 'globalUserId'), projectScope: required(projectScope, 'projectScope'), groupScope: optional(groupScope), threadScope: optional(threadScope) };
  if (scope.threadScope && !scope.groupScope) throw new TypeError('threadScope requires groupScope');
  return Object.freeze(scope);
}
function sameScope(a, b) { return a.globalUserId === b.globalUserId && a.projectScope === b.projectScope && a.groupScope === b.groupScope && a.threadScope === b.threadScope; }
function publicTurn(turn) { return Object.freeze({ ...clone(turn), recentTurns: Object.freeze((turn.recentTurns ?? []).map((item) => Object.freeze(clone(item)))) }); }

export class ConversationContextError extends Error {
  constructor(message, { code = 'conversation-context-error' } = {}) { super(message); this.name = 'ConversationContextError'; this.code = code; }
}

export function createInMemoryConversationContextStore() {
  const conversations = new Map(), sessions = new Map(), topics = new Map(), messages = new Map();
  return Object.freeze({
    async putConversation(record) { conversations.set(record.conversationId, clone(record)); return this.getConversation(record.conversationId); },
    async getConversation(id) { const value = conversations.get(id); return value ? clone(value) : null; },
    async findActiveConversation(scope) { return [...conversations.values()].filter((r) => r.state === 'active' && sameScope(r, scope)).sort((a,b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)))[0] ? clone([...conversations.values()].filter((r) => r.state === 'active' && sameScope(r, scope)).sort((a,b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)))[0]) : null; },
    async putSession(record) { sessions.set(record.sessionId, clone(record)); return clone(record); },
    async getSession(id) { const value = sessions.get(id); return value ? clone(value) : null; },
    async findActiveSession({ conversationId, transport, transportSessionId = null }) { return [...sessions.values()].filter((s) => s.conversationId === conversationId && s.transport === transport && s.state === 'active' && (!transportSessionId || s.transportSessionId === transportSessionId)).sort((a,b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)))[0] ? clone([...sessions.values()].filter((s) => s.conversationId === conversationId && s.transport === transport && s.state === 'active' && (!transportSessionId || s.transportSessionId === transportSessionId)).sort((a,b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)))[0]) : null; },
    async putTopic(record) { topics.set(record.topicId, clone(record)); return clone(record); },
    async getTopic(id) { const value = topics.get(id); return value ? clone(value) : null; },
    async putMessage(record) { if (record.transport && record.externalMessageId) { const duplicate = [...messages.values()].find((m) => m.transport === record.transport && m.externalMessageId === record.externalMessageId && sameScope(m, record)); if (duplicate) return clone(duplicate); } messages.set(record.messageId, clone(record)); return clone(record); },
    async getMessageByExternal({ transport, externalMessageId, scope }) { const value = [...messages.values()].find((m) => m.transport === transport && m.externalMessageId === externalMessageId && sameScope(m, scope)); return value ? clone(value) : null; },
    async listRecentMessages({ conversationId, topicId = null, limit = 12 }) { return [...messages.values()].filter((m) => m.conversationId === conversationId && (!topicId || m.topicId === topicId)).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)) || String(b.messageId).localeCompare(String(a.messageId))).slice(0, limit).reverse().map(clone); }
  });
}

export function createConversationContextService({ store, clock = () => new Date(), idFactory = randomUUID, maxRecentTurns = 12, audit = () => {} } = {}) {
  if (!store?.putConversation || !store?.getConversation || !store?.findActiveConversation || !store?.putSession || !store?.findActiveSession || !store?.putTopic || !store?.putMessage || !store?.getMessageByExternal || !store?.listRecentMessages) throw new TypeError('conversation context store is required');
  if (typeof clock !== 'function' || typeof idFactory !== 'function' || typeof audit !== 'function') throw new TypeError('invalid conversation context dependency');
  if (!Number.isInteger(maxRecentTurns) || maxRecentTurns < 1 || maxRecentTurns > 100) throw new TypeError('maxRecentTurns must be 1..100');

  async function emit({ event, scope, conversationId, sessionId = null, topicId = null, transport = null, reason = null }) {
    await audit(Object.freeze({ eventClass: 'conversation_transition', channel: 'telemetry', stage: 'conversation-context', outcome: event, actorRef: scope.globalUserId, data: Object.freeze({ conversationId, sessionId, topicId, projectScope: scope.projectScope, groupScope: scope.groupScope, threadScope: scope.threadScope, transport, reason }) }));
  }
  function assertConversationScope(conversation, scope) {
    if (conversation.globalUserId !== scope.globalUserId || conversation.projectScope !== scope.projectScope) throw new ConversationContextError('conversation identity/project mismatch', { code: 'conversation-scope-mismatch' });
    if (conversation.groupScope !== scope.groupScope || conversation.threadScope !== scope.threadScope) throw new ConversationContextError('conversation group/thread mismatch', { code: 'conversation-scope-mismatch' });
  }
  async function startConversation({ scope, transport, transportSessionId = null, continuationPolicy = 'same-scope', topicKey = null, metadata = {} }) {
    const now = clock().toISOString();
    const conversationId = `conversation:${idFactory()}`;
    const topicId = `topic:${idFactory()}`;
    const sessionId = `session:${idFactory()}`;
    const conversation = await store.putConversation({ conversationId, ...scope, state: 'active', continuationPolicy, currentTopicId: topicId, lastActivityAt: now, closedAt: null, metadata: safeObject(metadata), createdAt: now, updatedAt: now });
    await store.putTopic({ topicId, conversationId, parentTopicId: null, topicKey: optional(topicKey), state: 'active', startedAt: now, closedAt: null, metadata: {} });
    await store.putSession({ sessionId, conversationId, ...scope, transport, transportSessionId: optional(transportSessionId), state: 'active', startedAt: now, lastActivityAt: now, closedAt: null, metadata: {} });
    await emit({ event: 'started', scope, conversationId, sessionId, topicId, transport });
    return { conversation, sessionId, topicId, transition: 'start' };
  }
  async function ensureSession({ conversation, scope, transport, transportSessionId }) {
    let session = await store.findActiveSession({ conversationId: conversation.conversationId, transport, transportSessionId: optional(transportSessionId) });
    const now = clock().toISOString();
    if (!session) {
      session = await store.putSession({ sessionId: `session:${idFactory()}`, conversationId: conversation.conversationId, ...scope, transport, transportSessionId: optional(transportSessionId), state: 'active', startedAt: now, lastActivityAt: now, closedAt: null, metadata: {} });
      await emit({ event: 'session-started', scope, conversationId: conversation.conversationId, sessionId: session.sessionId, topicId: conversation.currentTopicId, transport });
    } else {
      session = await store.putSession({ ...session, lastActivityAt: now });
    }
    return session;
  }
  async function resolveConversation({ scope, transport, transportSessionId = null, replyToMessageId = null, continueConversationId = null }) {
    if (replyToMessageId) {
      const replied = await store.getMessageByExternal({ transport, externalMessageId: String(replyToMessageId), scope });
      if (replied) {
        const conversation = await store.getConversation(replied.conversationId);
        if (conversation?.state === 'active') { assertConversationScope(conversation, scope); return { conversation, transition: 'reply-continuation' }; }
      }
    }
    if (continueConversationId) {
      const conversation = await store.getConversation(required(continueConversationId, 'continueConversationId'));
      if (!conversation || conversation.state !== 'active') throw new ConversationContextError('requested conversation is unavailable', { code: 'conversation-unavailable' });
      if (conversation.globalUserId !== scope.globalUserId || conversation.projectScope !== scope.projectScope) throw new ConversationContextError('cross-identity/project continuation denied', { code: 'conversation-cross-scope-denied' });
      const exactScope = conversation.groupScope === scope.groupScope && conversation.threadScope === scope.threadScope;
      const approvedCrossTransport = conversation.continuationPolicy === 'approved-cross-transport' && !conversation.groupScope && !scope.groupScope && !conversation.threadScope && !scope.threadScope;
      if (!exactScope && !approvedCrossTransport) throw new ConversationContextError('conversation continuation scope denied', { code: 'conversation-cross-scope-denied' });
      return { conversation, transition: exactScope ? 'explicit-continuation' : 'approved-cross-transport' };
    }
    const conversation = await store.findActiveConversation(scope);
    return conversation ? { conversation, transition: 'continuation' } : null;
  }

  async function resolveTurn({ globalUserId, projectScope, groupScope = null, threadScope = null, transport, transportSessionId = null, platformMessageId = null, replyToMessageId = null, continueConversationId = null, topicShift = false, topicKey = null, text, metadata = {} } = {}) {
    const scope = normalizeScope({ globalUserId, projectScope, groupScope, threadScope });
    const transportName = required(transport, 'transport');
    const body = required(text, 'text');
    let resolved = await resolveConversation({ scope, transport: transportName, transportSessionId, replyToMessageId, continueConversationId });
    if (!resolved) resolved = await startConversation({ scope, transport: transportName, transportSessionId, continuationPolicy: 'same-scope', topicKey, metadata });
    let conversation = resolved.conversation;
    assertConversationScope(conversation, scope);
    let topicId = conversation.currentTopicId;
    let transition = resolved.transition;
    if (topicShift) {
      const now = clock().toISOString();
      if (topicId) { const oldTopic = await store.getTopic(topicId); if (oldTopic?.state === 'active') await store.putTopic({ ...oldTopic, state: 'closed', closedAt: now }); }
      const parentTopicId = topicId;
      topicId = `topic:${idFactory()}`;
      await store.putTopic({ topicId, conversationId: conversation.conversationId, parentTopicId, topicKey: optional(topicKey), state: 'active', startedAt: now, closedAt: null, metadata: {} });
      conversation = await store.putConversation({ ...conversation, currentTopicId: topicId, lastActivityAt: now, updatedAt: now });
      transition = 'topic-shift';
      await emit({ event: 'topic-shift', scope, conversationId: conversation.conversationId, topicId, transport: transportName });
    }
    const session = await ensureSession({ conversation, scope, transport: transportName, transportSessionId });
    const now = clock().toISOString();
    const inbound = await store.putMessage({ messageId: `message:${idFactory()}`, conversationId: conversation.conversationId, sessionId: session.sessionId, topicId, replyToMessageId: optional(replyToMessageId), transport: transportName, externalMessageId: optional(platformMessageId), direction: 'inbound', content: { text: body }, provenance: safeObject(metadata, 'provenance'), ...scope, createdAt: now });
    conversation = await store.putConversation({ ...conversation, lastActivityAt: now, updatedAt: now });
    const recent = await store.listRecentMessages({ conversationId: conversation.conversationId, topicId, limit: maxRecentTurns });
    await emit({ event: transition, scope, conversationId: conversation.conversationId, sessionId: session.sessionId, topicId, transport: transportName });
    return publicTurn({ conversationId: conversation.conversationId, sessionId: session.sessionId, topicId, transition, inboundMessageId: inbound.messageId, recentTurns: recent.map((m) => ({ messageId: m.messageId, direction: m.direction, text: m.content?.text ?? null, createdAt: m.createdAt, replyToMessageId: m.replyToMessageId ?? null })) });
  }

  async function recordOutbound({ conversationContext, globalUserId, projectScope, groupScope = null, threadScope = null, transport, platformMessageId = null, text, metadata = {} } = {}) {
    const scope = normalizeScope({ globalUserId, projectScope, groupScope, threadScope });
    const conversation = await store.getConversation(required(conversationContext?.conversationId, 'conversationContext.conversationId'));
    if (!conversation) throw new ConversationContextError('conversation not found', { code: 'conversation-not-found' });
    assertConversationScope(conversation, scope);
    const now = clock().toISOString();
    return store.putMessage({ messageId: `message:${idFactory()}`, conversationId: conversation.conversationId, sessionId: optional(conversationContext.sessionId), topicId: optional(conversationContext.topicId), replyToMessageId: optional(conversationContext.inboundMessageId), transport: required(transport, 'transport'), externalMessageId: optional(platformMessageId), direction: 'outbound', content: { text: required(text, 'text') }, provenance: safeObject(metadata, 'provenance'), ...scope, createdAt: now });
  }

  async function closeConversation({ conversationId, globalUserId, projectScope, groupScope = null, threadScope = null, reason = 'explicit-close' } = {}) {
    const scope = normalizeScope({ globalUserId, projectScope, groupScope, threadScope });
    const conversation = await store.getConversation(required(conversationId, 'conversationId'));
    if (!conversation) throw new ConversationContextError('conversation not found', { code: 'conversation-not-found' });
    assertConversationScope(conversation, scope);
    const now = clock().toISOString();
    const saved = await store.putConversation({ ...conversation, state: 'closed', closedAt: now, lastActivityAt: now, updatedAt: now });
    await emit({ event: 'closed', scope, conversationId, topicId: saved.currentTopicId, reason });
    return Object.freeze(clone(saved));
  }

  async function approveCrossTransportContinuation({ conversationId, globalUserId, projectScope } = {}) {
    const conversation = await store.getConversation(required(conversationId, 'conversationId'));
    if (!conversation || conversation.globalUserId !== required(globalUserId, 'globalUserId') || conversation.projectScope !== required(projectScope, 'projectScope')) throw new ConversationContextError('conversation scope mismatch', { code: 'conversation-scope-mismatch' });
    if (conversation.groupScope || conversation.threadScope) throw new ConversationContextError('group/thread conversations cannot become cross-transport private continuations', { code: 'conversation-cross-transport-denied' });
    return Object.freeze(clone(await store.putConversation({ ...conversation, continuationPolicy: 'approved-cross-transport', updatedAt: clock().toISOString() })));
  }

  return Object.freeze({ resolveTurn, recordOutbound, closeConversation, approveCrossTransportContinuation });
}
