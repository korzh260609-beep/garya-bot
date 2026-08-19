import { planHistoricalQuery } from './historicalQueryPlanner.js';
import { mergeHistoricalSearchResults } from './unifiedHistoricalResultMerger.js';
import { buildHistoricalOperationResult } from './historicalOperationResult.js';
import { retrieveLongTermConversationHistory } from '../conversation/longTermConversationHistory.js';

const MEMORY_HINTS = new Set(['user-memory', 'group-memory', 'thread-memory', 'topic-digest']);
const PROJECT_HINTS = new Set(['project-memory', 'pdk4', 'decision-memory', 'incident-memory']);
const DEFAULT_SOURCE_HINTS = Object.freeze(['conversation-history', 'user-memory']);
const MAX_ITEMS_PER_SOURCE = 40;
const MAX_TEXT = 5000;

function text(value, max = MAX_TEXT) {
  const normalized = String(value ?? '').trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, Math.max(0, max - 1))}…`;
}
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function errorView(error) {
  return freeze({ code: text(error?.code ?? 'historical-source-failed', 120), message: text(error?.message ?? 'Historical source failed', 500) });
}
function timestampInRange(timestamp, range) {
  if (!range || !timestamp) return true;
  const at = Date.parse(timestamp);
  const start = Date.parse(range.utcStart);
  const end = Date.parse(range.utcEndExclusive);
  if (!Number.isFinite(at) || !Number.isFinite(start) || !Number.isFinite(end)) return true;
  return start <= at && at < end;
}
function normalizedItem(input = {}) {
  return freeze({
    source: input.source,
    kind: input.kind ?? 'evidence',
    sourceId: input.sourceId ?? null,
    timestamp: input.timestamp ?? null,
    validFrom: input.validFrom ?? null,
    validTo: input.validTo ?? null,
    entityKey: input.entityKey ?? null,
    text: text(input.text),
    value: clone(input.value ?? null),
    relevance: input.relevance == null ? null : Number(input.relevance),
    trust: input.trust ?? null,
    confirmed: input.confirmed == null ? null : Boolean(input.confirmed),
    confidence: input.confidence == null ? null : Number(input.confidence),
    lifecycle: input.lifecycle ?? null,
    provenance: clone(input.provenance ?? null),
    metadata: clone(input.metadata ?? {})
  });
}
function sourceResult({ source, status, items = [], summary = null, diagnostics = {}, error = null, omission = null }) {
  return freeze({
    source,
    status,
    summary: summary == null ? null : text(summary),
    items: items.slice(0, MAX_ITEMS_PER_SOURCE),
    diagnostics: clone(diagnostics),
    error: error ? errorView(error) : null,
    omission: omission ? freeze({ reason: text(omission.reason, 240), detail: text(omission.detail ?? '', 500) || null }) : null
  });
}
function sameScope(planScope, request) {
  const scope = request?.scope ?? {};
  return planScope?.globalUserId === request?.actor?.globalUserId
    && planScope?.projectScope === scope.projectScope
    && (planScope?.groupScope ?? null) === (scope.groupScope ?? null)
    && (planScope?.threadScope ?? null) === (scope.threadScope ?? null);
}
function requestMemoryScope(request) {
  return freeze({
    userScope: request.actor.globalUserId,
    globalUserId: request.actor.globalUserId,
    projectScope: request.scope.projectScope,
    groupScope: request.scope.groupScope ?? null,
    threadScope: request.scope.threadScope ?? null
  });
}
function memoryLayers(hints, scope, omissions) {
  const layers = [];
  if (hints.includes('user-memory')) {
    layers.push('user-memory');
    if (scope.groupScope) layers.push('user-group-memory');
  }
  if (hints.includes('group-memory')) {
    if (scope.groupScope) layers.push('group-memory');
    else omissions.push({ source: 'group-memory', reason: 'group-scope-required' });
  }
  if (hints.includes('thread-memory')) {
    if (scope.groupScope && scope.threadScope) layers.push('thread-memory');
    else omissions.push({ source: 'thread-memory', reason: 'thread-scope-required' });
  }
  if (hints.includes('topic-digest')) layers.push('topic-digest');
  return [...new Set(layers)];
}
function normalizeMemory2(result, range) {
  return (result?.records ?? []).map((record) => normalizedItem({
    source: 'memory2', kind: record.layer ?? 'memory', sourceId: record.id,
    timestamp: record.provenance?.sourceTimestamp ?? record.updatedAt ?? record.createdAt ?? null,
    validFrom: record.createdAt ?? null, validTo: record.supersededAt ?? record.expiresAt ?? null,
    entityKey: record.key ?? null, text: typeof record.value === 'string' ? record.value : JSON.stringify(record.value ?? null),
    value: record.value, relevance: record.recallScore, trust: record.trust, confirmed: record.confirmed,
    confidence: record.confidence, lifecycle: record.lifecycleState, provenance: record.provenance,
    metadata: {
      layer: record.layer,
      privacyClass: record.privacyClass,
      tags: record.tags ?? [],
      supersededBy: record.supersededBy ?? null,
      semanticFingerprint: record.semanticFingerprint ?? null,
      recordVersion: record.recordVersion ?? null
    }
  })).filter((item) => timestampInRange(item.timestamp, range));
}
function normalizeProjectResults(source, result, range) {
  return (result?.results ?? []).map((item) => {
    const record = item.record ?? {};
    return normalizedItem({
      source, kind: record.factType ?? 'project-fact', sourceId: record.memoryId,
      timestamp: record.validFrom ?? record.updatedAt ?? record.createdAt ?? null,
      validFrom: record.validFrom ?? null, validTo: record.validTo ?? null, entityKey: record.entityKey ?? null,
      text: JSON.stringify(record.fact ?? {}), value: record.fact ?? null, relevance: item.score,
      trust: record.trust, confirmed: record.confirmed, confidence: record.confidence,
      lifecycle: record.lifecycleState, provenance: record.source,
      metadata: {
        namespace: record.namespace ?? null,
        semanticScore: item.semanticScore ?? null,
        lexicalScore: item.lexicalScore ?? null,
        exactScore: item.exactScore ?? null,
        relationExpanded: item.relationExpanded === true,
        successorMemoryId: record.successorMemoryId ?? null,
        supersededAt: record.supersededAt ?? null,
        semanticFingerprint: record.semanticFingerprint ?? null,
        confirmationState: record.confirmationState ?? null
      }
    });
  }).filter((item) => timestampInRange(item.timestamp, range));
}
function normalizeDevelopmentContext(context, range) {
  return (context?.projectMemoryContext?.facts ?? []).map((fact) => normalizedItem({
    source: 'pdk4', kind: fact.factType ?? 'development-fact', sourceId: fact.memoryId,
    timestamp: fact.validFrom ?? null, validFrom: fact.validFrom ?? null, validTo: fact.validTo ?? null,
    entityKey: fact.entityKey ?? null, text: JSON.stringify(fact.factData ?? {}), value: fact.factData ?? null,
    relevance: fact.retrieval?.score ?? null, trust: fact.trust, confirmed: fact.confirmed,
    confidence: fact.confidence, lifecycle: fact.lifecycleState, provenance: fact.provenance,
    metadata: {
      namespace: fact.namespace ?? null,
      currentness: fact.currentness ?? null,
      conflict: fact.conflict ?? null,
      successorMemoryId: fact.successorMemoryId ?? null,
      supersededAt: fact.supersededAt ?? null,
      semanticFingerprint: fact.semanticFingerprint ?? null,
      confirmationState: fact.confirmationState ?? null
    }
  })).filter((item) => timestampInRange(item.timestamp, range));
}
function normalizeIncidents(result, range) {
  return (result?.incidents ?? []).map((incident) => normalizedItem({
    source: 'incident-memory', kind: 'incident', sourceId: incident.memoryId,
    timestamp: incident.occurredAt ?? null, validFrom: incident.occurredAt ?? null, validTo: incident.resolvedAt ?? null,
    entityKey: incident.entityKey ?? null, text: incident.symptom ?? '', value: incident,
    relevance: incident.retrieval?.score ?? null, trust: incident.trust, confirmed: incident.confirmed,
    lifecycle: incident.lifecycleState ?? null, provenance: incident.provenance,
    metadata: { advisoryOnly: true, provesLiveRootCause: false, rootCauseEvidenceConfirmed: incident.rootCauseEvidenceConfirmed === true }
  })).filter((item) => timestampInRange(item.timestamp, range));
}
function normalizeConversation(result) {
  return (result?.turns ?? []).map((turn) => normalizedItem({
    source: 'conversation-history', kind: 'conversation-turn', sourceId: turn.messageId,
    timestamp: turn.createdAt ?? null, text: turn.text ?? '', value: { direction: turn.direction ?? null },
    provenance: { conversationId: turn.conversationId ?? null, topicId: turn.topicId ?? null, replyToMessageId: turn.replyToMessageId ?? null }
  }));
}
function projectMode(operation) {
  return ['timeline', 'fact-history'].includes(operation) ? 'project_development_evolution' : 'project_development_historical';
}

export const HISTORICAL_SEARCH_ORCHESTRATOR_CONTRACT_VERSION = 3;

export function createUnifiedHistoricalSearchOrchestrator({
  aiRouter,
  temporalService,
  conversationHistoryStore = null,
  memory2 = null,
  projectMemoryRetrieval = null,
  pdk4 = null,
  decisionIncidentMemory = null,
  planner = planHistoricalQuery,
  conversationHistoryRetrieve = retrieveLongTermConversationHistory
} = {}) {
  if (typeof planner !== 'function') throw new TypeError('Historical Query Planner is required');
  if (typeof conversationHistoryRetrieve !== 'function') throw new TypeError('Conversation History retrieval function is required');

  async function search({ request, query } = {}) {
    if (!request?.actor?.globalUserId || !request?.scope?.projectScope) throw new TypeError('HS3 requires resolved request identity and project scope');
    const plan = await planner({ aiRouter, temporalService, request, query });
    if (plan?.status === 'clarification-required') {
      return freeze({
        status: 'clarification-required',
        query: text(query, 2000),
        plan: clone(plan),
        selection: null,
        sources: [],
        merged: null,
        operationResult: null,
        contract: {
          version: HISTORICAL_SEARCH_ORCHESTRATOR_CONTRACT_VERSION,
          stage: 'HS4',
          sourceOrchestrationStage: 'HS3',
          mergeStage: 'HS4',
          authorizationExpanded: false
        }
      });
    }
    if (plan?.status !== 'planned') throw new TypeError('Historical Query Planner returned unsupported plan status');
    if (!sameScope(plan.scope, request)) {
      const error = new Error('Historical plan scope does not match resolved request scope');
      error.code = 'historical-orchestrator-plan-scope-mismatch';
      throw error;
    }

    const hints = plan.sourceHints?.length ? [...plan.sourceHints] : [...DEFAULT_SOURCE_HINTS];
    const defaulted = !plan.sourceHints?.length;
    const omissions = [];
    const sources = [];
    const scope = plan.scope;

    async function run(source, fn) {
      try {
        const value = await fn();
        sources.push(value);
      } catch (error) {
        sources.push(sourceResult({ source, status: 'failed', error }));
      }
    }

    if (hints.includes('conversation-history')) {
      if (!conversationHistoryStore) {
        sources.push(sourceResult({ source: 'conversation-history', status: 'failed', error: { code: 'conversation-history-unavailable', message: 'Conversation History store is not configured' } }));
      } else {
        await run('conversation-history', async () => {
          const result = await conversationHistoryRetrieve({ store: conversationHistoryStore, aiRouter, request, query: plan.query, temporalRange: plan.temporalRange });
          const items = normalizeConversation(result);
          return sourceResult({ source: 'conversation-history', status: items.length || result?.summary ? 'ok' : 'empty', items, summary: result?.summary ?? null, diagnostics: result?.retrieval ?? {} });
        });
      }
    }

    const selectedMemoryHints = hints.filter((hint) => MEMORY_HINTS.has(hint));
    const layers = memoryLayers(selectedMemoryHints, scope, omissions);
    if (selectedMemoryHints.length && layers.length) {
      if (!memory2?.recall) {
        sources.push(sourceResult({ source: 'memory2', status: 'failed', error: { code: 'memory2-unavailable', message: 'Memory 2.0 recall is not configured' } }));
      } else {
        await run('memory2', async () => {
          const result = await memory2.recall({
            scope: requestMemoryScope(request), actor: request.actor, query: plan.semanticSubject,
            layers, includeHistory: true, maxRecords: 40, maxCharacters: 30000,
            traceContext: request.traceContext ?? null
          });
          const items = normalizeMemory2(result, plan.temporalRange);
          return sourceResult({ source: 'memory2', status: items.length ? 'ok' : 'empty', items, diagnostics: { ...(result?.diagnostics ?? {}), requestedLayers: layers, requestedHints: selectedMemoryHints, conflicts: result?.conflicts ?? [] } });
        });
      }
    }

    if (hints.includes('project-memory')) {
      if (!projectMemoryRetrieval?.search) {
        sources.push(sourceResult({ source: 'project-memory', status: 'failed', error: { code: 'project-memory-unavailable', message: 'Project Memory retrieval is not configured' } }));
      } else {
        await run('project-memory', async () => {
          const result = await projectMemoryRetrieval.search({ actor: request.actor, projectKey: scope.projectScope, query: plan.semanticSubject, includeHistorical: true, lifecycleStates: ['active', 'superseded', 'archived'], limit: 24, maxCandidates: 160, expandRelations: true, relationLimit: 8 });
          const items = normalizeProjectResults('project-memory', result, plan.temporalRange);
          return sourceResult({ source: 'project-memory', status: items.length ? 'ok' : 'empty', items, diagnostics: { semanticMode: result?.semanticMode ?? null, count: result?.count ?? 0 } });
        });
      }
    }

    if (hints.includes('pdk4')) {
      if (!pdk4?.contextForRequest) {
        sources.push(sourceResult({ source: 'pdk4', status: 'failed', error: { code: 'pdk4-unavailable', message: 'PDK4 query integration is not configured' } }));
      } else {
        await run('pdk4', async () => {
          const context = await pdk4.contextForRequest({ request, query: plan.semanticSubject, projectKey: scope.projectScope, semanticIntent: projectMode(plan.operation) });
          const items = normalizeDevelopmentContext(context, plan.temporalRange);
          return sourceResult({ source: 'pdk4', status: items.length ? 'ok' : 'empty', items, diagnostics: { mode: context?.mode ?? null, qualification: context?.qualification ?? null } });
        });
      }
    }

    if (hints.includes('decision-memory')) {
      if (!projectMemoryRetrieval?.search) {
        sources.push(sourceResult({ source: 'decision-memory', status: 'failed', error: { code: 'decision-memory-unavailable', message: 'Canonical Project Memory decision retrieval seam is not configured' } }));
      } else {
        await run('decision-memory', async () => {
          const result = await projectMemoryRetrieval.search({ actor: request.actor, projectKey: scope.projectScope, query: plan.semanticSubject, factTypes: ['architecture-decision'], includeHistorical: true, lifecycleStates: ['active', 'superseded', 'archived'], limit: 16, maxCandidates: 120, expandRelations: true, relationLimit: 6 });
          const items = normalizeProjectResults('decision-memory', result, plan.temporalRange);
          return sourceResult({ source: 'decision-memory', status: items.length ? 'ok' : 'empty', items, diagnostics: { semanticMode: result?.semanticMode ?? null, count: result?.count ?? 0, canonicalSeam: 'project-memory-hybrid-retrieval' } });
        });
      }
    }

    if (hints.includes('incident-memory')) {
      if (!decisionIncidentMemory?.findIncidentGuidance) {
        sources.push(sourceResult({ source: 'incident-memory', status: 'failed', error: { code: 'incident-memory-unavailable', message: 'Decision / Incident memory seam is not configured' } }));
      } else {
        await run('incident-memory', async () => {
          const result = await decisionIncidentMemory.findIncidentGuidance({ actor: request.actor, projectKey: scope.projectScope, query: plan.semanticSubject, limit: 8 });
          const items = normalizeIncidents(result, plan.temporalRange);
          return sourceResult({ source: 'incident-memory', status: items.length ? 'ok' : 'empty', items, diagnostics: { advisoryOnly: result?.advisoryOnly === true, provesLiveRootCause: result?.provesLiveRootCause === true, requiresLiveVerification: result?.requiresLiveVerification === true } });
        });
      }
    }

    for (const omission of omissions) {
      sources.push(sourceResult({ source: omission.source, status: 'omitted', omission: { reason: omission.reason } }));
    }

    const requestedCanonicalSources = [
      ...(hints.includes('conversation-history') ? ['conversation-history'] : []),
      ...(selectedMemoryHints.length ? ['memory2'] : []),
      ...(hints.filter((hint) => PROJECT_HINTS.has(hint)))
    ];
    const partial = sources.some((source) => source.status === 'failed' || source.status === 'omitted');
    const merged = mergeHistoricalSearchResults({ plan, sources });
    const operationResult = buildHistoricalOperationResult({ plan, merged });
    return freeze({
      status: partial ? 'partial' : 'completed',
      query: plan.query,
      plan: clone(plan),
      selection: {
        sourceHints: hints,
        canonicalSources: [...new Set(requestedCanonicalSources)],
        defaulted,
        omissions: clone(omissions),
        authorizationScopeSource: 'resolved-request-only'
      },
      sources,
      merged,
      operationResult,
      contract: {
        version: HISTORICAL_SEARCH_ORCHESTRATOR_CONTRACT_VERSION,
        stage: operationResult ? 'HS5' : 'HS4',
        sourceOrchestrationStage: 'HS3',
        mergeStage: 'HS4',
        historicalOperationStage: operationResult ? 'HS5' : null,
        normalized: true,
        crossSourceRanking: true,
        crossSourceDeduplication: true,
        conflictsPreserved: true,
        supersessionPreserved: true,
        authorizationExpanded: false,
        sourceFailuresExplicit: true,
        historicalOperationsDeterministic: true
      }
    });
  }

  return freeze({ search });
}
