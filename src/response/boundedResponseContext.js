import { redactSensitiveData } from '../secrets/redaction.js';

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function boundedString(value, max = 1000) {
  if (value == null) return null;
  const text = String(value);
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}
function memoryView(record) {
  return Object.freeze({
    id: record.id ?? null,
    layer: record.layer ?? null,
    key: record.key,
    value: clone(record.value),
    trust: record.trust,
    confirmed: record.confirmed,
    updatedAt: record.updatedAt,
    privacyClass: record.privacyClass ?? null,
    scopeKind: record.memoryScope?.kind ?? null,
    provenance: { sourceType: record.provenance?.sourceType ?? null, sourceId: record.provenance?.sourceId ?? null }
  });
}
function conversationView(turn) {
  const text = turn.text ?? turn.content?.text ?? null;
  return Object.freeze({ direction: turn.direction, text: boundedString(text, 800), createdAt: turn.createdAt, replyToMessageId: turn.replyToMessageId ?? null });
}
function selfFactView(fact) {
  return Object.freeze({ category: fact.category, key: fact.key, value: clone(fact.value), status: fact.status, confidence: fact.confidence, provenance: { sourceType: fact.provenance.sourceType, sourceId: fact.provenance.sourceId, sourceRevision: fact.provenance.sourceRevision } });
}
function jsonLength(value) { return JSON.stringify(value).length; }
function memoryQueryForRequest(request, semanticMessage) {
  const candidates = [request?.input?.memoryQuery, request?.input?.semanticMessage, semanticMessage, request?.input?.text];
  for (const candidate of candidates) if (typeof candidate === 'string' && candidate.trim()) return boundedString(candidate.trim(), 2000);
  return '';
}
function numericDiagnostic(diagnostics, ...keys) {
  for (const key of keys) {
    const value = Number(diagnostics?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}
function determineKnowledgeState({ records, reportedUserMemory, conflicts, diagnostics }) {
  if ((conflicts?.length ?? 0) > 0 || numericDiagnostic(diagnostics, 'conflictCount') > 0) return 'CONFLICTED';
  if ((records ?? []).some((record) => record.confirmed === true)) return 'KNOWN';
  if ((reportedUserMemory?.length ?? 0) > 0) return 'UNCERTAIN';
  if (numericDiagnostic(diagnostics, 'expiredCount', 'excludedExpired', 'excludedLifecycle', 'staleCount', 'outdatedCount') > 0) return 'OUTDATED';
  return 'UNKNOWN';
}
async function resolveConversationHistory({ request, conversationContextService, temporalService, maxConversationTurns }) {
  const query = request.input?.conversationHistoryQuery ?? null;
  if (!query || !conversationContextService?.retrieveHistory) return null;
  let temporalRange = request.input?.temporalResolution ?? null;
  if (query.temporalExpression && temporalService?.resolveForUser) {
    const resolved = await temporalService.resolveForUser(request.actor.globalUserId, query.temporalExpression, {
      referenceInstant: request.input?.temporalContext?.referenceInstant ?? undefined
    });
    temporalRange = resolved.status === 'resolved' ? resolved : null;
  }
  const conversationRef = request.input?.conversationContext ?? null;
  const useConversation = query.scope === 'current-conversation' || query.scope === 'current-topic';
  const useTopic = query.scope === 'current-topic';
  const history = await conversationContextService.retrieveHistory({
    globalUserId: request.actor.globalUserId,
    projectScope: request.scope.projectScope,
    groupScope: request.scope.groupScope ?? null,
    threadScope: request.scope.threadScope ?? null,
    conversationId: useConversation ? conversationRef?.conversationId ?? null : null,
    topicId: useTopic ? conversationRef?.topicId ?? null : null,
    query: query.query,
    temporalRange,
    limit: Math.min(query.maxRecords ?? 100, Math.max(maxConversationTurns, 1) * 10, 200)
  });
  return Object.freeze({
    query: boundedString(history.query, 2000),
    scope: query.scope,
    temporalExpression: query.temporalExpression ?? null,
    temporalRange: clone(history.temporalRange),
    turns: Object.freeze(history.turns.map(conversationView))
  });
}

export function createBoundedResponseContextAssembler({
  memoryProvider,
  selfKnowledgeService,
  environment,
  revision = 'unknown',
  conversationContextStore = null,
  conversationContextService = null,
  temporalService = null,
  runtimeEvidenceProvider = null,
  observability = null,
  maxUserMemory = 8,
  maxProjectMemory = 8,
  maxSharedMemory = 8,
  maxConversationTurns = 8,
  maxSelfKnowledgeFacts = 12,
  maxCharacters = 24000
} = {}) {
  if (!memoryProvider?.query) throw new TypeError('memoryProvider.query is required');
  if (!selfKnowledgeService?.query) throw new TypeError('selfKnowledgeService.query is required');
  const env = required(environment, 'environment');
  const runtimeRevision = required(revision, 'revision');
  for (const [name, value, max] of [['maxUserMemory',maxUserMemory,50],['maxProjectMemory',maxProjectMemory,50],['maxSharedMemory',maxSharedMemory,50],['maxConversationTurns',maxConversationTurns,50],['maxSelfKnowledgeFacts',maxSelfKnowledgeFacts,50]]) {
    if (!Number.isInteger(value) || value < 0 || value > max) throw new TypeError(`${name} must be 0..${max}`);
  }
  if (!Number.isInteger(maxCharacters) || maxCharacters < 2000 || maxCharacters > 100000) throw new TypeError('maxCharacters must be 2000..100000');

  return Object.freeze({
    async assemble({ request, semanticMessage = null } = {}) {
      if (!request?.actor?.globalUserId || !request?.scope?.projectScope) throw new TypeError('resolved request actor/scope is required');
      const identity = request.actor;
      const scope = request.scope;
      const now = new Date().toISOString();
      const workspaceMemoryEnabled = request.input?.workspaceRuntimePolicy?.workspaceMemoryEnabled !== false;
      const layers = workspaceMemoryEnabled
        ? ['user-memory','user-group-memory','group-memory','thread-memory','project-memory']
        : ['user-memory','user-group-memory','project-memory'];
      const memoryQuery = memoryQueryForRequest(request, semanticMessage);
      const queried = typeof memoryProvider.recall === 'function'
        ? await memoryProvider.recall({ scope, actor: identity, query: memoryQuery, layers, maxRecords: Math.max(1, maxUserMemory * 2 + maxProjectMemory + maxSharedMemory), maxCharacters: Math.max(2000, Math.floor(maxCharacters * 0.6)) })
        : await memoryProvider.query({ scope, layers: ['user-memory','project-memory'], keys: [], now, actor: identity });
      const confirmed = queried.records.filter((record) => record.confirmed === true);
      const reported = queried.records.filter((record) => record.confirmed !== true && record.trust === 'reported');
      const allUserMemory = confirmed.filter((record) => record.layer === 'user-memory' || record.layer === 'user-group-memory');
      const allReportedUserMemory = reported.filter((record) => record.layer === 'user-memory' || record.layer === 'user-group-memory');
      const allProjectMemory = confirmed.filter((record) => record.layer === 'project-memory');
      const allSharedMemory = confirmed.filter((record) => workspaceMemoryEnabled && (record.layer === 'group-memory' || record.layer === 'thread-memory'));
      const userMemory = allUserMemory.slice(0, maxUserMemory).map(memoryView);
      const reportedUserMemory = allReportedUserMemory.slice(0, maxUserMemory).map(memoryView);
      const projectMemory = allProjectMemory.slice(0, maxProjectMemory).map(memoryView);
      const sharedMemory = allSharedMemory.slice(0, maxSharedMemory).map(memoryView);
      const conflicts = clone(queried.conflicts ?? []);
      const diagnostics = clone(queried.diagnostics ?? {});
      const knowledgeState = determineKnowledgeState({ records: queried.records, reportedUserMemory, conflicts, diagnostics });

      let recentTurns = [];
      const conversationRef = request.input?.conversationContext ?? null;
      if (conversationContextStore?.listRecentMessages && conversationRef?.conversationId && maxConversationTurns > 0) {
        recentTurns = await conversationContextStore.listRecentMessages({ conversationId: conversationRef.conversationId, topicId: conversationRef.topicId ?? null, limit: maxConversationTurns });
      }
      const conversation = recentTurns.slice(-maxConversationTurns).map(conversationView);
      const conversationHistory = await resolveConversationHistory({ request, conversationContextService, temporalService, maxConversationTurns });
      const selfKnowledge = await selfKnowledgeService.query({ environment: env, maxFacts: Math.max(1, maxSelfKnowledgeFacts || 1) });
      let temporalContext = request.input?.temporalContext ?? null;
      if (!temporalContext && temporalService?.contextForUser) temporalContext = await temporalService.contextForUser(identity.globalUserId);
      const runtimeEvidence = runtimeEvidenceProvider ? await runtimeEvidenceProvider({ request, semanticMessage: memoryQuery }) : null;

      const context = {
        version: '2.3',
        identity: {
          globalUserId: identity.globalUserId,
          platform: identity.platform ?? null,
          platformUserId: identity.platformUserId ?? null,
          roles: [...(identity.roles ?? [])].slice(0, 10),
          grants: [...(identity.grants ?? [])].slice(0, 20),
          authenticationLevel: identity.authenticationLevel ?? null,
          profile: clone(identity.profile ?? null),
          profileAuthority: 'descriptive-only'
        },
        scope: { userScope: scope.userScope, projectScope: scope.projectScope, groupScope: scope.groupScope ?? null, threadScope: scope.threadScope ?? null },
        confirmedUserMemory: userMemory,
        reportedUserMemory,
        confirmedProjectMemory: projectMemory,
        confirmedSharedMemory: sharedMemory,
        memoryRecall: {
          workspaceMemoryEnabled,
          query: memoryQuery,
          querySource: request.input?.memoryQuery ? 'semantic-memory-query' : request.input?.semanticMessage ? 'semantic-interpretation' : semanticMessage ? 'caller-semantic-message' : 'canonical-message',
          knowledgeState,
          diagnostics,
          conflicts
        },
        conversationContext: { conversationId: conversationRef?.conversationId ?? null, topicId: conversationRef?.topicId ?? null, recentTurns: conversation },
        conversationHistory,
        selfKnowledge: { snapshotVersion: selfKnowledge.snapshot?.version ?? null, sourceRevision: selfKnowledge.snapshot?.sourceRevision ?? null, validationStatus: selfKnowledge.snapshot?.validationStatus ?? 'invalid', facts: selfKnowledge.facts.slice(0, maxSelfKnowledgeFacts).map(selfFactView) },
        userSettings: clone(request.input?.userPreferences ?? null),
        languageContext: clone(request.input?.languageContext ?? null),
        temporalContext: clone(temporalContext),
        runtimeEvidence: clone(runtimeEvidence),
        provenance: { memoryReturned: confirmed.length + reportedUserMemory.length, reportedUserMemoryReturned: reportedUserMemory.length, memoryCandidateCount: queried.diagnostics?.candidateCount ?? queried.records.length, memoryConflictCount: queried.diagnostics?.conflictCount ?? 0, conversationHistoryReturned: conversationHistory?.turns?.length ?? 0, selfKnowledgeConflictCount: selfKnowledge.diagnostics.conflictCount ?? 0 },
        truncationEvidence: { userMemory: allUserMemory.length > userMemory.length, reportedUserMemory: allReportedUserMemory.length > reportedUserMemory.length, projectMemory: allProjectMemory.length > projectMemory.length, sharedMemory: allSharedMemory.length > sharedMemory.length, recall: Boolean(queried.diagnostics?.truncated), conversation: recentTurns.length > conversation.length, conversationHistory: false, selfKnowledge: selfKnowledge.diagnostics.truncated, totalBudget: false }
      };
      const safe = redactSensitiveData(context);
      const trimOrder = [
        () => safe.conversationHistory?.turns?.pop(),
        () => safe.conversationContext.recentTurns.pop(),
        () => safe.confirmedSharedMemory.pop(),
        () => safe.confirmedProjectMemory.pop(),
        () => safe.reportedUserMemory.pop(),
        () => safe.confirmedUserMemory.pop(),
        () => safe.selfKnowledge.facts.pop()
      ];
      let guard = 0;
      while (jsonLength(safe) > maxCharacters && guard < 200) {
        guard += 1;
        let changed = false;
        for (const trim of trimOrder) {
          const before = jsonLength(safe);
          trim();
          if (jsonLength(safe) < before) { changed = true; safe.truncationEvidence.totalBudget = true; if (safe.conversationHistory) safe.truncationEvidence.conversationHistory = true; break; }
        }
        if (!changed) break;
      }
      if (jsonLength(safe) > maxCharacters) throw new RangeError('bounded response context cannot satisfy character budget');
      const telemetryTrace = Object.freeze({
        traceId: required(request.traceContext?.traceId, 'request.traceContext.traceId'),
        requestId: required(request.traceContext?.requestId, 'request.traceContext.requestId'),
        environment: request.traceContext?.environment ?? env,
        revision: request.traceContext?.revision ?? runtimeRevision
      });
      observability?.record?.({
        eventClass: 'audit_event', channel: 'telemetry', stage: 'response-context', outcome: 'assembled', traceContext: telemetryTrace,
        actorRef: identity.globalUserId,
        data: { responseContextEventClass: 'response_context_assembled', knowledgeState: safe.memoryRecall.knowledgeState, memoryQuerySource: safe.memoryRecall.querySource, userMemoryCount: safe.confirmedUserMemory.length, reportedUserMemoryCount: safe.reportedUserMemory.length, projectMemoryCount: safe.confirmedProjectMemory.length, sharedMemoryCount: safe.confirmedSharedMemory.length, workspaceMemoryEnabled: safe.memoryRecall.workspaceMemoryEnabled, memoryConflictCount: safe.provenance.memoryConflictCount, conversationTurnCount: safe.conversationContext.recentTurns.length, conversationHistoryTurnCount: safe.conversationHistory?.turns?.length ?? 0, selfKnowledgeFactCount: safe.selfKnowledge.facts.length, selfKnowledgeVersion: safe.selfKnowledge.snapshotVersion, selfKnowledgeValidationStatus: safe.selfKnowledge.validationStatus, truncated: safe.truncationEvidence }
      });
      return Object.freeze(clone(safe));
    }
  });
}
