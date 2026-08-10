const QUERY_MODES = Object.freeze(['current','historical','evolution','rationale','evidence','comparison','planning','incident-history','genesis']);
const HISTORICAL_MODES = new Set(['historical','evolution','rationale','comparison','incident-history','genesis']);

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

const MODE_PATTERNS = Object.freeze({
  genesis: [/\bgenesis\b/u,/\borigin\b/u,/\bcreation\b/u,/\bstarted?\b/u,/\bначал/u,/\bсоздан/u,/\bпроисхожд/u,/\bвиток/u,/\bствор/u,/\bпоходжен/u],
  'incident-history': [/\bincident/u,/\boutage/u,/\bfailure/u,/\bregression/u,/\bbug history\b/u,/\bинцидент/u,/\bсбой/u,/\bавари/u,/\bошибк.*истор/u,/\bістор.*помил/u,/\bзбій/u],
  planning: [/\broadmap\b/u,/\bnext plan/u,/\bwhat next\b/u,/\bplanned\b/u,/\bплан/u,/\bдальше\b/u,/\bдалее\b/u,/\bследующ/u,/\bнаступн/u,/\bдалі\b/u],
  comparison: [/\bcompare/u,/\bversus\b/u,/\bvs\b/u,/\bdifference/u,/\bbefore and after\b/u,/\bсравн/u,/\bотлич/u,/\bдо и после\b/u,/\bпорівн/u,/\bвідмін/u],
  evidence: [/\bevidence\b/u,/\bprovenance\b/u,/\bproof\b/u,/\bverified\b/u,/\bverification\b/u,/\bci\b/u,/\bдоказ/u,/\bподтверж/u,/\bпроверен/u,/\bпровенанс/u,/\bдоказ/u,/\bпідтвердж/u,/\bперевір/u],
  rationale: [/\bwhy\b/u,/\brationale\b/u,/\breason\b/u,/\bdecision reason\b/u,/\bпочему\b/u,/\bзачем\b/u,/\bпричин/u,/\bобоснован/u,/\bчому\b/u,/\bнавіщо\b/u,/\bобґрунт/u],
  evolution: [/\bevolution\b/u,/\bevolved\b/u,/\bchanged over time\b/u,/\bhow .* changed\b/u,/\bистори.*развит/u,/\bэволюц/u,/\bкак .* менял/u,/\bразвивал/u,/\bістор.*розвит/u,/\bеволюц/u,/\bяк .* змін/u],
  historical: [/\bhistorical\b/u,/\bhistory\b/u,/\bpreviously\b/u,/\bformerly\b/u,/\bat that time\b/u,/\bистор/u,/\bраньше\b/u,/\bранее\b/u,/\bтогда\b/u,/\bістор/u,/\bраніше\b/u,/\bтоді\b/u]
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

export function createDevelopmentQueryIntegration({ projectMemoryIntegration } = {}) {
  if (!projectMemoryIntegration || typeof projectMemoryIntegration.contextForRequest !== 'function'
    || typeof projectMemoryIntegration.prepareModelContext !== 'function'
    || typeof projectMemoryIntegration.deterministicAnswer !== 'function') {
    throw new TypeError('projectMemoryIntegration contract is required');
  }

  async function contextForRequest({ request, query, projectKey = request?.scope?.projectScope, semanticIntent = request?.input?.semanticIntent ?? null } = {}) {
    const canonicalQuery = required(query ?? request?.input?.text, 'query');
    const mode = classifyDevelopmentQueryMode({ query: canonicalQuery, semanticIntent });
    const includeHistorical = HISTORICAL_MODES.has(mode);
    const lifecycleStates = includeHistorical ? ['active','superseded'] : ['active'];
    const allowedTemporalStates = includeHistorical ? ['current','superseded','expired'] : ['current'];
    const projectMemoryContext = await projectMemoryIntegration.contextForRequest({
      request,
      query: canonicalQuery,
      projectKey,
      includeHistorical,
      lifecycleStates,
      allowedTemporalStates
    });
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
      ? (language === 'ru' ? ' Исторические факты не считаются текущим состоянием без актуального подтверждения.' : language === 'uk' ? ' Історичні факти не вважаються поточним станом без актуального підтвердження.' : ' Historical facts are not current state without current evidence.')
      : '';
    const incident = context.qualification.incidentSimilarityAdvisoryOnly
      ? (language === 'ru' ? ' Сходство с прошлыми инцидентами только справочное и не доказывает текущую причину.' : language === 'uk' ? ' Подібність до минулих інцидентів лише довідкова і не доводить поточну причину.' : ' Similarity to past incidents is advisory only and does not prove the current root cause.')
      : '';
    return `${modeLabel}\n${base}${historical}${incident}`;
  }

  return Object.freeze({ classifyDevelopmentQueryMode, contextForRequest, prepareModelContext, deterministicAnswer });
}
