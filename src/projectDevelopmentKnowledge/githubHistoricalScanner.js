import { createHash } from 'node:crypto';

export const PDK4_HISTORICAL_SCANNER_CONTRACT_VERSION = 1;
export const PDK4_HISTORICAL_SOURCE_KIND = 'github-commit';
export const PDK4_HISTORICAL_BATCH_LIMITS = Object.freeze({ min: 1, default: 50, max: 200 });

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function normalizeProjectKey(value) { return requiredString(value, 'projectKey').toLowerCase(); }
function normalizeRepository(value) {
  const repository = requiredString(value, 'repository').toLowerCase();
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repository)) throw new TypeError('repository must be owner/name');
  return repository;
}
function boundedLimit(value) {
  const number = Number(value ?? PDK4_HISTORICAL_BATCH_LIMITS.default);
  if (!Number.isInteger(number) || number < PDK4_HISTORICAL_BATCH_LIMITS.min || number > PDK4_HISTORICAL_BATCH_LIMITS.max) {
    throw new TypeError(`batchLimit must be between ${PDK4_HISTORICAL_BATCH_LIMITS.min} and ${PDK4_HISTORICAL_BATCH_LIMITS.max}`);
  }
  return number;
}
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}
function sha256(value) { return createHash('sha256').update(String(value)).digest('hex'); }
function normalizeCommit(commit, repository) {
  if (!commit || typeof commit !== 'object') throw new TypeError('history source commit must be an object');
  const sha = requiredString(commit.sha, 'commit.sha').toLowerCase();
  if (!/^[a-f0-9]{7,64}$/.test(sha)) throw new TypeError('commit.sha must be a hexadecimal git revision');
  const committedAt = requiredString(commit.committedAt ?? commit.timestamp, 'commit.committedAt');
  if (Number.isNaN(Date.parse(committedAt))) throw new TypeError('commit.committedAt must be ISO timestamp');
  const sourceId = `github:${repository}:commit:${sha}`;
  const fingerprint = sha256(stable({ repository, sha }));
  return Object.freeze({
    sourceId,
    fingerprint,
    sha,
    repository,
    committedAt: new Date(committedAt).toISOString(),
    position: commit.position == null ? null : String(commit.position),
    metadata: Object.freeze({
      author: commit.author == null ? null : String(commit.author),
      message: commit.message == null ? null : String(commit.message).slice(0, 500),
      parentShas: Object.freeze([...(commit.parentShas ?? [])].map(String))
    }),
    raw: commit
  });
}

export function createGitHubHistoricalScanner({ historySource, cursorStore, onSource = async () => {} } = {}) {
  if (typeof historySource?.listCommits !== 'function') throw new TypeError('historySource.listCommits is required');
  if (!cursorStore?.getCursor || !cursorStore?.ensureCursor || !cursorStore?.listProcessedSourceIds || !cursorStore?.commitBatch) {
    throw new TypeError('durable PDK4 cursorStore is required');
  }
  if (typeof onSource !== 'function') throw new TypeError('onSource must be a function');

  async function scanBatch({ projectKey, repository, batchLimit = PDK4_HISTORICAL_BATCH_LIMITS.default } = {}) {
    const project = normalizeProjectKey(projectKey);
    const repo = normalizeRepository(repository);
    const limit = boundedLimit(batchLimit);
    const sourceKind = PDK4_HISTORICAL_SOURCE_KIND;
    const cursor = await cursorStore.ensureCursor({ projectKey: project, sourceKind, sourceScope: repo });
    if (cursor.status === 'complete') {
      return Object.freeze({ status: 'complete', projectKey: project, repository: repo, fetched: 0, processed: 0, skipped: 0, cursor });
    }

    let page;
    try {
      page = await historySource.listCommits({ repository: repo, cursorToken: cursor.cursorToken, limit, order: 'asc' });
    } catch (error) {
      await cursorStore.markFailed?.({ projectKey: project, sourceKind, sourceScope: repo });
      throw error;
    }
    if (!page || !Array.isArray(page.commits)) throw new TypeError('historySource.listCommits must return { commits, nextCursorToken, complete }');
    if (page.commits.length > limit) throw new Error('history source exceeded requested batch limit');

    const normalized = page.commits.map((commit) => normalizeCommit(commit, repo));
    const ids = normalized.map((source) => source.sourceId);
    const already = new Set(await cursorStore.listProcessedSourceIds({ projectKey: project, sourceKind, sourceScope: repo, sourceIds: ids }));
    const unseen = normalized.filter((source) => !already.has(source.sourceId));

    const processedSources = [];
    try {
      for (const source of unseen) {
        await onSource(Object.freeze({ projectKey: project, repository: repo, source }));
        processedSources.push({
          sourceId: source.sourceId,
          fingerprint: source.fingerprint,
          position: source.position,
          timestamp: source.committedAt,
          metadata: { sha: source.sha }
        });
      }
    } catch (error) {
      await cursorStore.markFailed?.({ projectKey: project, sourceKind, sourceScope: repo });
      throw error;
    }

    const pageComplete = page.complete === true;
    if (!pageComplete && page.commits.length === 0 && (page.nextCursorToken ?? null) === (cursor.cursorToken ?? null)) {
      const error = new Error('history source made no progress');
      error.code = 'pdk4-history-source-stalled';
      await cursorStore.markFailed?.({ projectKey: project, sourceKind, sourceScope: repo });
      throw error;
    }
    const nextCursorToken = page.nextCursorToken == null ? cursor.cursorToken : String(page.nextCursorToken);
    const lastSourceId = normalized.at(-1)?.sourceId ?? cursor.lastSourceId;
    const committed = await cursorStore.commitBatch({
      projectKey: project,
      sourceKind,
      sourceScope: repo,
      expectedCursorToken: cursor.cursorToken,
      nextCursorToken,
      lastSourceId,
      processedSources,
      complete: pageComplete
    });

    return Object.freeze({
      status: committed.status,
      projectKey: project,
      repository: repo,
      fetched: normalized.length,
      processed: processedSources.length,
      skipped: normalized.length - processedSources.length,
      cursor: committed
    });
  }

  async function scanToCurrent({ projectKey, repository, batchLimit = PDK4_HISTORICAL_BATCH_LIMITS.default, maxBatches = 1000 } = {}) {
    const boundedMaxBatches = Number(maxBatches);
    if (!Number.isInteger(boundedMaxBatches) || boundedMaxBatches < 1 || boundedMaxBatches > 10000) throw new TypeError('maxBatches must be between 1 and 10000');
    let batches = 0;
    let processed = 0;
    let fetched = 0;
    let last;
    while (batches < boundedMaxBatches) {
      last = await scanBatch({ projectKey, repository, batchLimit });
      batches += 1;
      processed += last.processed;
      fetched += last.fetched;
      if (last.status === 'complete') return Object.freeze({ status: 'complete', batches, processed, fetched, cursor: last.cursor });
    }
    return Object.freeze({ status: 'partial', batches, processed, fetched, cursor: last?.cursor ?? null });
  }

  return Object.freeze({ scanBatch, scanToCurrent });
}
