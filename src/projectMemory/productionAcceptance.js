const CRITERIA = Object.freeze([
  'trustedSourceVerified',
  'durableWrite',
  'restartContinuity',
  'hybridRetrieval',
  'contextGuard',
  'normalRequestUsedProjectMemory',
  'provenancePresent',
  'currentnessQualified',
  'replayIdempotent',
  'conflictsVisible',
  'rawChatSelfConfirmBlocked',
  'renderLiveSourceBlocked',
  'supersededFactExcluded'
]);

function bool(value) { return value === true; }
function boundedText(value, max = 160) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

export const PROJECT_MEMORY3_PRODUCTION_ACCEPTANCE_CONTRACT_VERSION = 1;
export const PROJECT_MEMORY3_PRODUCTION_ACCEPTANCE_CRITERIA = CRITERIA;

export function createProjectMemoryProductionAcceptanceReport(input = {}) {
  const checks = Object.fromEntries(CRITERIA.map((name) => [name, bool(input[name])]));
  const failedCriteria = CRITERIA.filter((name) => checks[name] !== true);
  const accepted = failedCriteria.length === 0;
  const evidence = {
    runtimeRevision: boundedText(input.runtimeRevision),
    sourceKind: boundedText(input.sourceKind),
    sourceVerification: boundedText(input.sourceVerification),
    retrievalMode: boundedText(input.retrievalMode),
    contextKind: boundedText(input.contextKind),
    answerPath: boundedText(input.answerPath),
    replayOutcome: boundedText(input.replayOutcome),
    conflictOutcome: boundedText(input.conflictOutcome),
    supersessionOutcome: boundedText(input.supersessionOutcome),
    rawMemoryIncluded: false,
    secretMaterialIncluded: false
  };
  return freeze({
    contractVersion: PROJECT_MEMORY3_PRODUCTION_ACCEPTANCE_CONTRACT_VERSION,
    kind: 'ProjectMemoryProductionAcceptance',
    status: accepted ? 'accepted' : 'rejected',
    accepted,
    checks,
    failedCriteria,
    evidence
  });
}
