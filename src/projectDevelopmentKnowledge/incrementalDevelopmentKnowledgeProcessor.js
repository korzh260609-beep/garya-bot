export const PDK4_INCREMENTAL_PROCESSOR_CONTRACT_VERSION = 1;

function required(value, name) { if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`); return value.trim(); }
function sha(value) { const text = required(value,'commitSha').toLowerCase(); if (!/^[a-f0-9]{40}$/.test(text)) throw new TypeError('commitSha must be a full immutable git SHA'); return text; }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }
function fail(code,message){const e=new Error(message);e.code=code;throw e;}

export function createIncrementalDevelopmentKnowledgeProcessor({ sourceNormalizer, classifier, extractor, projectMemoryStore, reconciliationUpdater = null } = {}) {
  if (typeof sourceNormalizer?.normalizeAndVerify !== 'function') throw new TypeError('sourceNormalizer.normalizeAndVerify is required');
  if (typeof classifier?.classify !== 'function') throw new TypeError('classifier.classify is required');
  if (typeof extractor?.extract !== 'function') throw new TypeError('extractor.extract is required');
  if (typeof projectMemoryStore?.put !== 'function') throw new TypeError('projectMemoryStore.put is required');
  if (reconciliationUpdater && typeof reconciliationUpdater.update !== 'function') throw new TypeError('reconciliationUpdater.update is required');

  async function processCommit({ projectKey, repository, commitSha, triggerId = null, triggerType = 'poll', traceContext = null } = {}) {
    const project = required(projectKey,'projectKey').toLowerCase();
    const repo = required(repository,'repository').toLowerCase();
    const commit = sha(commitSha);
    const normalized = await sourceNormalizer.normalizeAndVerify({ kind:'github-commit', projectKey:project, repository:repo, sha:commit });
    if (normalized.projectKey !== project || normalized.repository !== repo || normalized.payload?.sha !== commit || normalized.trust !== 'verified-source') fail('pdk4-incremental-source-mismatch','verified source does not match incremental commit');
    const classification = await classifier.classify(normalized,{traceContext});
    if (classification.projectKey !== project || classification.sourceId !== normalized.sourceId || classification.authorityAllowed !== false) fail('pdk4-incremental-classification-mismatch','classification does not match verified source');

    if (!classification.retain || !classification.eventEligible) {
      return freeze({ status:'processed', disposition:'non-event', projectKey:project, repository:repo, commitSha:commit, sourceFingerprint:normalized.sourceFingerprint, occurredAt:normalized.occurredAt, normalizedSource:normalized, classification, extraction:null, projectMemoryCandidate:null, reconciliation:null, triggerId, triggerType });
    }

    const extraction = await extractor.extract(normalized,classification,{traceContext});
    if (extraction.trust !== 'extracted-candidate' || extraction.confirmed !== false || extraction.candidate?.confirmed !== false) fail('pdk4-incremental-extraction-promotion','extraction attempted to promote trust/confirmation');
    const stored = await projectMemoryStore.put(extraction.candidate);
    if (!stored || stored.projectKey !== project || stored.confirmed !== false || stored.trust === 'confirmed') fail('pdk4-incremental-pm3-promotion','incremental Project Memory candidate must remain unconfirmed');
    const reconciliation = reconciliationUpdater ? await reconciliationUpdater.update({ projectKey:project, repository:repo, extraction, storedCandidate:stored, triggerId, triggerType }) : null;
    if (reconciliation && (reconciliation.projectKey !== project || reconciliation.authorityAllowed !== false || reconciliation.confirmed !== false)) fail('pdk4-incremental-reconciliation-promotion','incremental reconciliation must remain non-authoritative');
    return freeze({ status:'processed', disposition:'event', projectKey:project, repository:repo, commitSha:commit, sourceFingerprint:normalized.sourceFingerprint, occurredAt:normalized.occurredAt, normalizedSource:normalized, classification, extraction, projectMemoryCandidate:stored, reconciliation, triggerId, triggerType });
  }

  return Object.freeze({ processCommit });
}
