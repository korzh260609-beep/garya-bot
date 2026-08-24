const QUERY_MODES = Object.freeze(['current','historical','evolution','rationale','evidence','comparison','planning','incident-history','genesis']);
const HISTORICAL_MODES = new Set(['historical','evolution','rationale','comparison','incident-history','genesis']);
const SEMANTIC_INTENT_TO_MODE = Object.freeze({
  project_development_current: 'current',
  project_development_historical: 'historical',
  project_development_evolution: 'evolution',
  project_development_rationale: 'rationale',
  project_development_evidence: 'evidence',
  project_development_comparison: 'comparison',
  project_development_planning: 'planning',
  project_development_incident_history: 'incident-history',
  project_development_genesis: 'genesis'
});
const MODE_FACT_TYPES = Object.freeze({
  current: [],
  historical: ['project-event','feature-status','architecture-decision','roadmap-state','incident','integration-status','infrastructure-state','security-state','identity-state','memory-state'],
  evolution: ['project-event','feature-status','architecture-decision','integration-status','infrastructure-state','security-state','identity-state','memory-state'],
  rationale: ['project-event','architecture-decision'],
  evidence: [],
  comparison: ['project-event','feature-status','architecture-decision','roadmap-state','incident','integration-status','infrastructure-state','security-state','identity-state','memory-state'],
  planning: ['project-event','roadmap-state'],
  'incident-history': ['project-event','incident'],
  genesis: ['project-event','architecture-decision','roadmap-state']
});

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function cloneJson(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function sourceKind(record) { return String(record?.source?.kind ?? '').trim().toLowerCase(); }
function isRelevant(item) {
  return Number(item?.exactScore ?? 0) > 0 || Number(item?.lexicalScore ?? 0) > 0 || Number(item?.semanticScore ?? 0) >= 0.55;
}
function isStrongFallbackRelevant(item) {
  return Number(item?.exactScore ?? 0) > 0 || Number(item?.lexicalScore ?? 0) >= 0.5 || Number(item?.semanticScore ?? 0) >= 0.7;
}
function directRelevantAnchors(items, { strong = false } = {}) {
  const predicate = strong ? isStrongFallbackRelevant : isRelevant;
  return items.filter((item) => item?.relationExpanded !== true && predicate(item));
}
function anchorBoundResults(items, anchors) {
  const anchorIds = new Set(anchors.map((item) => item?.record?.memoryId).filter(Boolean));
  return items.filter((item) => {
    if (item?.relationExpanded !== true) return anchorIds.has(item?.record?.memoryId);
    return typeof item?.relationSourceMemoryId === 'string' && anchorIds.has(item.relationSourceMemoryId);
  });
}
function isAutonomousVerified(item) {
  const record = item?.record;
  return sourceKind(record) === 'github'
    && record?.trust === 'verified'
    && record?.confirmed === false
    && record?.confirmationState === 'proposed'
    && record?.metadata?.pdk4AutonomousIngestion === true
    && record?.metadata?.pdk4SourceVerified === true;
}
function authorizationActor(request, projectKey) {
  const globalUserId = required(request?.actor?.globalUserId, 'request.actor.globalUserId');
  if (required(request?.scope?.projectScope, 'request.scope.projectScope').toLowerCase() !== projectKey) {
    const error = new Error('resolved request project scope does not match Development Knowledge project');
    error.code = 'pdk4-development-query-scope-mismatch';
    throw error;
  }
  return deepFreeze({
    ...cloneJson(request.actor),
    projectMemoryAuthorization: {
      source: 'resolved-request-scope',
      projectScope: projectKey,
      actorGlobalUserId: globalUserId
    }
  });
}

export const PDK4_DEVELOPMENT_QUERY_INTEGRATION_CONTRACT_VERSION = 2;
export const PDK4_DEVELOPMENT_QUERY_MODES = QUERY_MODES;
export const PDK4_DEVELOPMENT_SEMANTIC_INTENTS = Object.freeze(Object.keys(SEMANTIC_INTENT_TO_MODE));

export function classifyDevelopmentQueryMode({ semanticIntent = null } = {}) {
  const normalizedIntent = String(semanticIntent ?? '').trim().toLowerCase();
  return SEMANTIC_INTENT_TO_MODE[normalizedIntent] ?? null;
}

export function createDevelopmentQueryIntegration({ projectMemoryIntegration, retrieval, contextGuard } = {}) {
  if (!projectMemoryIntegration || typeof projectMemoryIntegration.contextForRequest !== 'function'
    || typeof projectMemoryIntegration.prepareModelContext !== 'function'
    || typeof projectMemoryIntegration.deterministicAnswer !== 'function') throw new TypeError('projectMemoryIntegration contract is required');
  if (!retrieval?.search) throw new TypeError('Project Memory retrieval.search is required');
  if (!contextGuard?.build) throw new TypeError('Project Memory contextGuard.build is required');

  async function autonomousVerifiedContext({ request, query, projectKey, mode, includeHistorical, strongAnchor = false }) {
    const actor = authorizationActor(request, projectKey);
    const retrievalResult = await retrieval.search({
      actor,
      projectKey,
      query,
      factTypes: MODE_FACT_TYPES[mode],
      includeHistorical,
      lifecycleStates: includeHistorical ? ['active','superseded'] : ['active'],
      limit: 16,
      maxCandidates: 144,
      expandRelations: true,
      relationLimit: 8
    });
    const autonomousVerified = retrievalResult.results.filter(isAutonomousVerified);
    const anchors = directRelevantAnchors(autonomousVerified, { strong: strongAnchor });
    if (anchors.length === 0) return null;
    const autonomous = anchorBoundResults(autonomousVerified, anchors);
    const guarded = await contextGuard.build({
      actor,
      projectKey,
      retrievalResult: Object.freeze({ ...retrievalResult, results: Object.freeze(autonomous) }),
      allowedTrust: ['verified'],
      allowedLifecycleStates: includeHistorical ? ['active','superseded'] : ['active'],
      allowedTemporalStates: includeHistorical ? ['current','superseded','expired'] : ['current'],
      includeProposed: true,
      maxFacts: 12,
      maxTokens: 2400
    });
    return guarded.facts.length > 0 ? guarded : null;
  }

  async function historicalContext({ request, query, projectKey, mode }) {
    const actor = authorizationActor(request, projectKey);
    const retrievalResult = await retrieval.search({
      actor,
      projectKey,
      query,
      factTypes: MODE_FACT_TYPES[mode],
      includeHistorical: true,
      lifecycleStates: ['active','superseded'],
      limit: 16,
      maxCandidates: 144,
      expandRelations: true,
      relationLimit: 8
    });
    const trusted = retrievalResult.results.filter((item) => sourceKind(item?.record) === 'github');
    const anchors = directRelevantAnchors(trusted);
    if (anchors.length === 0) return null;
    const relevant = anchorBoundResults(trusted, anchors);
    const guarded = await contextGuard.build({
      actor,
      projectKey,
      retrievalResult: Object.freeze({ ...retrievalResult, results: Object.freeze(relevant) }),
      allowedTrust: ['verified','confirmed'],
      allowedLifecycleStates: ['active','superseded'],
      allowedTemporalStates: ['current','superseded','expired'],
      includeProposed: false,
      maxFacts: 12,
      maxTokens: 2400
    });
    if (guarded.facts.length > 0) return guarded;
    return autonomousVerifiedContext({ request, query, projectKey, mode, includeHistorical: true });
  }

  async function contextForRequest({ request, query, projectKey = request?.scope?.projectScope, semanticIntent = request?.input?.semanticIntent ?? null } = {}) {
    const canonicalQuery = required(query ?? request?.input?.text, 'query');
    const project = required(projectKey, 'projectKey').toLowerCase();
    let mode = classifyDevelopmentQueryMode({ semanticIntent });
    let semanticFallbackActivated = false;
    let projectMemoryContext = null;

    if (!mode) {
      projectMemoryContext = await autonomousVerifiedContext({
        request,
        query: canonicalQuery,
        projectKey: project,
        mode: 'evidence',
        includeHistorical: false,
        strongAnchor: true
      });
      if (!projectMemoryContext) return null;
      mode = 'evidence';
      semanticFallbackActivated = true;
    }

    const includeHistorical = HISTORICAL_MODES.has(mode);
    if (!projectMemoryContext) {
      if (includeHistorical) {
        projectMemoryContext = await historicalContext({ request, query: canonicalQuery, projectKey: project, mode });
      } else {
        projectMemoryContext = await projectMemoryIntegration.contextForRequest({ request, query: canonicalQuery, projectKey: project });
        if (!projectMemoryContext) projectMemoryContext = await autonomousVerifiedContext({ request, query: canonicalQuery, projectKey: project, mode, includeHistorical: false });
      }
    }
    if (!projectMemoryContext) return null;
    const includesAutonomousProposed = projectMemoryContext.facts.some((fact) => fact.confirmed === false && fact.trust === 'verified');
    return deepFreeze({
      contractVersion: PDK4_DEVELOPMENT_QUERY_INTEGRATION_CONTRACT_VERSION,
      kind: 'DevelopmentQueryContext',
      projectKey: projectMemoryContext.projectKey,
      mode,
      query: canonicalQuery,
      projectMemoryContext: cloneJson(projectMemoryContext),
      qualification: {
        includeHistorical,
        semanticIntentMatched: !semanticFallbackActivated,
        semanticFallbackActivated,
        semanticFallbackBasis: semanticFallbackActivated ? 'strong-direct-relevant-source-verified-project-memory-anchor' : null,
        provenanceRequired: true,
        currentnessRequired: true,
        historicalFactsMustRemainQualified: includeHistorical,
        incidentSimilarityAdvisoryOnly: mode === 'incident-history',
        sourceVerifiedProposedFactsMayBeIncluded: includesAutonomousProposed,
        monarchConfirmationImplied: false,
        liveDiagnosisAuthorityAllowed: false,
        authorityAllowed: false,
        trustPromotionAllowed: false,
        confirmationPromotionAllowed: false
      },
      dataPolicy: {
        contentIsDataOnly: true,
        executableInstructionsAllowed: false,
        authorityFromKnowledgeAllowed: false,
        secretsAllowed: false
      }
    });
  }

  function prepareModelContext({ boundedResponseContext = null, developmentQueryContext = null } = {}) {
    const projectMemoryContext = developmentQueryContext?.projectMemoryContext ?? null;
    const base = projectMemoryIntegration.prepareModelContext({ boundedResponseContext, projectMemoryContext });
    return deepFreeze({
      boundedResponseContext: cloneJson(base.boundedResponseContext),
      projectMemoryContext: cloneJson(base.projectMemoryContext),
      developmentQuery: developmentQueryContext ? {
        contractVersion: developmentQueryContext.contractVersion,
        kind: developmentQueryContext.kind,
        projectKey: developmentQueryContext.projectKey,
        mode: developmentQueryContext.mode,
        qualification: cloneJson(developmentQueryContext.qualification),
        dataPolicy: cloneJson(developmentQueryContext.dataPolicy)
      } : null
    });
  }

  function deterministicAnswer({ context, responseLanguage = 'en' } = {}) {
    if (!context || context.kind !== 'DevelopmentQueryContext') throw new TypeError('DevelopmentQueryContext is required');
    const base = projectMemoryIntegration.deterministicAnswer({ context: context.projectMemoryContext, responseLanguage });
    const language = String(responseLanguage ?? 'en').toLowerCase();
    const modeLabel = language === 'ru' ? `Режим PDK4: ${context.mode}.` : language === 'uk' ? `Режим PDK4: ${context.mode}.` : `PDK4 mode: ${context.mode}.`;
    const historical = context.qualification.historicalFactsMustRemainQualified
      ? (language === 'ru' ? ' Исторические факты не считаются текущим состоянием без актуального подтверждения.' : language === 'uk' ? ' Історичні факти не вважаються поточним станом без актуального підтвердження.' : ' Historical facts are not current state without current evidence.') : '';
    const proposed = context.qualification.sourceVerifiedProposedFactsMayBeIncluded
      ? (language === 'ru' ? ' Некоторые факты автоматически подтверждены неизменяемым источником GitHub, но не подтверждены Монархом.' : language === 'uk' ? ' Деякі факти автоматично підтверджені незмінним джерелом GitHub, але не підтверджені Монархом.' : ' Some facts are verified from immutable GitHub evidence but are not Monarch-confirmed.') : '';
    const incident = context.qualification.incidentSimilarityAdvisoryOnly
      ? (language === 'ru' ? ' Сходство с прошлыми инцидентами только справочное и не доказывает текущую причину.' : language === 'uk' ? ' Подібність до минулих інцидентів лише довідкова і не доводить поточну причину.' : ' Similarity to past incidents is advisory only and does not prove the current root cause.') : '';
    return `${modeLabel}\n${base}${historical}${proposed}${incident}`;
  }

  return Object.freeze({ classifyDevelopmentQueryMode, contextForRequest, prepareModelContext, deterministicAnswer });
}
