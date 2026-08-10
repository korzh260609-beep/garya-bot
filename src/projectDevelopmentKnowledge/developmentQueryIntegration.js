const QUERY_MODES = Object.freeze(['current','historical','evolution','rationale','evidence','comparison','planning','incident-history','genesis']);
const HISTORICAL_MODES = new Set(['historical','evolution','rationale','comparison','incident-history','genesis']);
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
function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function hasAny(text, patterns) { return patterns.some((pattern) => pattern.test(text)); }
function sourceKind(record) { return String(record?.source?.kind ?? '').trim().toLowerCase(); }
function isRelevant(item) {
  return Number(item?.exactScore ?? 0) > 0 || Number(item?.lexicalScore ?? 0) > 0 || Number(item?.semanticScore ?? 0) >= 0.55;
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

const MODE_PATTERNS = Object.freeze({
  genesis: [/\bgenesis\b/u,/\borigin\b/u,/\bcreation\b/u,/\bstarted?\b/u,/начал/u,/создан/u,/происхожд/u,/виток/u,/створ/u,/походжен/u],
  'incident-history': [/\bincident/u,/\boutage/u,/\bfailure/u,/\bregression/u,/\bbug history\b/u,/инцидент/u,/сбой/u,/авари/u,/ошибк.*истор/u,/істор.*помил/u,/збій/u],
  planning: [/\broadmap\b/u,/\bnext plan/u,/\bwhat next\b/u,/\bplanned\b/u,/план/u,/дальше/u,/далее/u,/следующ/u,/наступн/u,/далі/u],
  comparison: [/\bcompare/u,/\bversus\b/u,/\bvs\b/u,/\bdifference/u,/\bbefore and after\b/u,/сравн/u,/отлич/u,/до и после/u,/порівн/u,/відмін/u],
  evidence: [/\bevidence\b/u,/\bprovenance\b/u,/\bproof\b/u,/\bverified\b/u,/\bverification\b/u,/\bci\b/u,/доказ/u,/подтверж/u,/проверен/u,/провенанс/u,/підтвердж/u,/перевір/u],
  rationale: [/\bwhy\b/u,/\brationale\b/u,/\breason\b/u,/\bdecision reason\b/u,/почему/u,/зачем/u,/причин/u,/обоснован/u,/чому/u,/навіщо/u,/обґрунт/u],
  evolution: [/\bevolution\b/u,/\bevolv(?:e|ed|es|ing)\b/u,/\bchanged over time\b/u,/\bhow .* changed\b/u,/истори.*развит/u,/эволюц/u,/как .* менял/u,/развивал/u,/істор.*розвит/u,/еволюц/u,/як .* змін/u],
  historical: [/\bhistorical\b/u,/\bhistory\b/u,/\bpreviously\b/u,/\bformerly\b/u,/\bat that time\b/u,/истор/u,/раньше/u,/ранее/u,/тогда/u,/істор/u,/раніше/u,/тоді/u]
});

export const PDK4_DEVELOPMENT_QUERY_INTEGRATION_CONTRACT_VERSION = 1;
export const PDK4_DEVELOPMENT_QUERY_MODES = QUERY_MODES;

export function classifyDevelopmentQueryMode({ query, semanticIntent = null } = {}) {
  const text = normalize(`${semanticIntent ?? ''} ${required(query, 'query')}`);
  for (const mode of ['genesis','incident-history','planning','comparison','evidence','rationale','evolution','historical']) {
    if (hasAny(text, MODE_PATTERNS[mode])) return mode;
  }
  return 'current';
}

export function createDevelopmentQueryIntegration({ projectMemoryIntegration, retrieval, contextGuard } = {}) {
  if (!projectMemoryIntegration || typeof projectMemoryIntegration.contextForRequest !== 'function'
    || typeof projectMemoryIntegration.prepareModelContext !== 'function'
    || typeof projectMemoryIntegration.deterministicAnswer !== 'function') throw new TypeError('projectMemoryIntegration contract is required');
  if (!retrieval?.search) throw new TypeError('Project Memory retrieval.search is required');
  if (!contextGuard?.build) throw new TypeError('Project Memory contextGuard.build is required');

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
    const anchors = trusted.filter(isRelevant);
    if (anchors.length === 0) return null;
    const anchorIds = new Set(anchors.map((item) => item.record.memoryId));
    const relevant = trusted.filter((item) => anchorIds.has(item.record.memoryId) || item.relationExpanded === true);
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
    return guarded.facts.length > 0 ? guarded : null;
  }

  async function contextForRequest({ request, query, projectKey = request?.scope?.projectScope, semanticIntent = request?.input?.semanticIntent ?? null } = {}) {
    const canonicalQuery = required(query ?? request?.input?.text, 'query');
    const project = required(projectKey, 'projectKey').toLowerCase();
    const mode = classifyDevelopmentQueryMode({ query: canonicalQuery, semanticIntent });
    const includeHistorical = HISTORICAL_MODES.has(mode);
    const projectMemoryContext = includeHistorical
      ? await historicalContext({ request, query: canonicalQuery, projectKey: project, mode })
      : await projectMemoryIntegration.contextForRequest({ request, query: canonicalQuery, projectKey: project });
    if (!projectMemoryContext) return null;
    return deepFreeze({
      contractVersion: PDK4_DEVELOPMENT_QUERY_INTEGRATION_CONTRACT_VERSION,
      kind: 'DevelopmentQueryContext',
      projectKey: projectMemoryContext.projectKey,
      mode,
      query: canonicalQuery,
      projectMemoryContext: cloneJson(projectMemoryContext),
      qualification: {
        includeHistorical,
        provenanceRequired: true,
        currentnessRequired: true,
        historicalFactsMustRemainQualified: includeHistorical,
        incidentSimilarityAdvisoryOnly: mode === 'incident-history',
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
    const incident = context.qualification.incidentSimilarityAdvisoryOnly
      ? (language === 'ru' ? ' Сходство с прошлыми инцидентами только справочное и не доказывает текущую причину.' : language === 'uk' ? ' Подібність до минулих інцидентів лише довідкова і не доводить поточну причину.' : ' Similarity to past incidents is advisory only and does not prove the current root cause.') : '';
    return `${modeLabel}\n${base}${historical}${incident}`;
  }

  return Object.freeze({ classifyDevelopmentQueryMode, contextForRequest, prepareModelContext, deterministicAnswer });
}
