import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import {
  createGitHubHistoricalScanner,
  createPostgresHistoricalCursorStore
} from '../src/projectDevelopmentKnowledge/index.js';

function sha(number) { return number.toString(16).padStart(40, '0'); }
function commit(number) {
  return {
    sha: sha(number),
    committedAt: new Date(Date.UTC(2026, 0, 1, 0, number, 0)).toISOString(),
    position: number,
    message: `commit-${number}`,
    parentShas: number > 1 ? [sha(number - 1)] : []
  };
}

function createPagedSource(commits) {
  return {
    async listCommits({ cursorToken, limit, order }) {
      assert.equal(order, 'asc');
      const offset = cursorToken == null ? 0 : Number(cursorToken);
      const slice = commits.slice(offset, offset + limit);
      const next = offset + slice.length;
      return {
        commits: slice,
        nextCursorToken: String(next),
        complete: next >= commits.length
      };
    }
  };
}

function createMemoryCursorStore() {
  const cursors = new Map();
  const processed = new Map();
  const keyOf = ({ projectKey, sourceKind, sourceScope }) => `${projectKey}|${sourceKind}|${sourceScope}`;
  const cloneCursor = (row) => Object.freeze({ ...row });
  return {
    async ensureCursor(scope) {
      const key = keyOf(scope);
      if (!cursors.has(key)) cursors.set(key, { ...scope, cursorToken: null, lastSourceId: null, scannedCount: 0, batchCount: 0, status: 'pending' });
      return cloneCursor(cursors.get(key));
    },
    async getCursor(scope) { return cursors.has(keyOf(scope)) ? cloneCursor(cursors.get(keyOf(scope))) : null; },
    async listProcessedSourceIds(scope) {
      const bucket = processed.get(keyOf(scope)) ?? new Set();
      return scope.sourceIds.filter((id) => bucket.has(id));
    },
    async commitBatch(input) {
      const key = keyOf(input);
      const current = cursors.get(key);
      if ((current.cursorToken ?? null) !== (input.expectedCursorToken ?? null)) {
        const error = new Error('cursor conflict'); error.code = 'pdk4-cursor-conflict'; throw error;
      }
      const bucket = processed.get(key) ?? new Set();
      let inserted = 0;
      for (const source of input.processedSources) if (!bucket.has(source.sourceId)) { bucket.add(source.sourceId); inserted += 1; }
      processed.set(key, bucket);
      const row = {
        ...current,
        cursorToken: input.nextCursorToken,
        lastSourceId: input.lastSourceId,
        scannedCount: current.scannedCount + inserted,
        batchCount: current.batchCount + 1,
        status: input.complete ? 'complete' : 'scanning',
        insertedProcessedSources: inserted
      };
      cursors.set(key, row);
      return cloneCursor(row);
    },
    async markFailed(scope) { const key = keyOf(scope); const current = cursors.get(key) ?? await this.ensureCursor(scope); cursors.set(key, { ...current, status: 'failed' }); },
    async countProcessed(scope) { return (processed.get(keyOf(scope)) ?? new Set()).size; }
  };
}

test('PDK4.2: scanner processes GitHub history oldest-first in bounded batches', async () => {
  const store = createMemoryCursorStore();
  const seen = [];
  const scanner = createGitHubHistoricalScanner({
    historySource: createPagedSource([commit(1), commit(2), commit(3), commit(4), commit(5)]),
    cursorStore: store,
    onSource: async ({ source }) => seen.push(source.sha)
  });

  const result = await scanner.scanToCurrent({ projectKey: 'sg2.1', repository: 'korzh260609-beep/garya-bot', batchLimit: 2 });
  assert.equal(result.status, 'complete');
  assert.equal(result.batches, 3);
  assert.equal(result.processed, 5);
  assert.equal(result.cursor.scannedCount, 5);
  assert.deepEqual(seen, [sha(1), sha(2), sha(3), sha(4), sha(5)]);
});

test('PDK4.2: completed cursor makes replay idempotent and does not refetch history', async () => {
  const store = createMemoryCursorStore();
  let fetches = 0;
  let processed = 0;
  const source = createPagedSource([commit(1), commit(2)]);
  const scanner = createGitHubHistoricalScanner({
    historySource: { async listCommits(args) { fetches += 1; return source.listCommits(args); } },
    cursorStore: store,
    onSource: async () => { processed += 1; }
  });
  const first = await scanner.scanToCurrent({ projectKey: 'sg2.1', repository: 'korzh260609-beep/garya-bot', batchLimit: 1 });
  const second = await scanner.scanToCurrent({ projectKey: 'sg2.1', repository: 'korzh260609-beep/garya-bot', batchLimit: 1 });
  assert.equal(first.processed, 2);
  assert.equal(second.processed, 0);
  assert.equal(processed, 2);
  assert.equal(fetches, 2);
  assert.equal(await store.countProcessed({ projectKey: 'sg2.1', sourceKind: 'github-commit', sourceScope: 'korzh260609-beep/garya-bot' }), 2);
});

test('PDK4.2: failed source processing does not advance durable cursor', async () => {
  const store = createMemoryCursorStore();
  let fail = true;
  const scanner = createGitHubHistoricalScanner({
    historySource: createPagedSource([commit(1), commit(2)]),
    cursorStore: store,
    onSource: async ({ source }) => { if (fail && source.sha === sha(2)) throw new Error('synthetic failure'); }
  });
  await assert.rejects(() => scanner.scanBatch({ projectKey: 'sg2.1', repository: 'korzh260609-beep/garya-bot', batchLimit: 2 }), /synthetic failure/);
  const afterFailure = await store.getCursor({ projectKey: 'sg2.1', sourceKind: 'github-commit', sourceScope: 'korzh260609-beep/garya-bot' });
  assert.equal(afterFailure.cursorToken, null);
  assert.equal(afterFailure.scannedCount, 0);
  fail = false;
  const recovered = await scanner.scanBatch({ projectKey: 'sg2.1', repository: 'korzh260609-beep/garya-bot', batchLimit: 2 });
  assert.equal(recovered.status, 'complete');
  assert.equal(recovered.cursor.scannedCount, 2);
});

test('PDK4.2: stalled history source fails closed instead of inventing progress', async () => {
  const store = createMemoryCursorStore();
  const scanner = createGitHubHistoricalScanner({
    historySource: { async listCommits() { return { commits: [], nextCursorToken: null, complete: false }; } },
    cursorStore: store
  });
  await assert.rejects(
    () => scanner.scanBatch({ projectKey: 'sg2.1', repository: 'korzh260609-beep/garya-bot' }),
    (error) => error.code === 'pdk4-history-source-stalled'
  );
});

test('PDK4.2: batch limits are bounded', async () => {
  const scanner = createGitHubHistoricalScanner({ historySource: createPagedSource([]), cursorStore: createMemoryCursorStore() });
  await assert.rejects(() => scanner.scanBatch({ projectKey: 'sg2.1', repository: 'korzh260609-beep/garya-bot', batchLimit: 201 }), /batchLimit/);
});

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('PDK4.2: PostgreSQL cursor survives restart and resumes without duplicate processed sources', async () => {
  const suffix = randomUUID();
  const projectKey = `pdk42-${suffix}`.toLowerCase();
  const repository = `korzh260609-beep/garya-bot-${suffix}`.toLowerCase();
  const commits = [commit(1), commit(2), commit(3), commit(4), commit(5)];
  const historySource = createPagedSource(commits);

  const firstPersistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pdk4.2-first' });
  await firstPersistence.start();
  const firstStore = createPostgresHistoricalCursorStore(firstPersistence.database);
  const firstScanner = createGitHubHistoricalScanner({ historySource, cursorStore: firstStore });
  const firstBatch = await firstScanner.scanBatch({ projectKey, repository, batchLimit: 2 });
  assert.equal(firstBatch.status, 'scanning');
  assert.equal(firstBatch.cursor.cursorToken, '2');
  assert.equal(firstBatch.cursor.scannedCount, 2);
  await firstPersistence.close();

  const restarted = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pdk4.2-restart' });
  await restarted.start();
  const restartedStore = createPostgresHistoricalCursorStore(restarted.database);
  const resumedBeforeScan = await restartedStore.getCursor({ projectKey, sourceKind: 'github-commit', sourceScope: repository });
  assert.equal(resumedBeforeScan.cursorToken, '2');
  assert.equal(resumedBeforeScan.scannedCount, 2);

  const restartedScanner = createGitHubHistoricalScanner({ historySource, cursorStore: restartedStore });
  const completed = await restartedScanner.scanToCurrent({ projectKey, repository, batchLimit: 2 });
  assert.equal(completed.status, 'complete');
  assert.equal(completed.processed, 3);
  assert.equal(completed.cursor.scannedCount, 5);
  assert.equal(await restartedStore.countProcessed({ projectKey, sourceKind: 'github-commit', sourceScope: repository }), 5);

  const replay = await restartedScanner.scanToCurrent({ projectKey, repository, batchLimit: 2 });
  assert.equal(replay.processed, 0);
  assert.equal(await restartedStore.countProcessed({ projectKey, sourceKind: 'github-commit', sourceScope: repository }), 5);

  await restarted.database.query('DELETE FROM pdk4_processed_sources WHERE project_key=$1', [projectKey]);
  await restarted.database.query('DELETE FROM pdk4_history_cursors WHERE project_key=$1', [projectKey]);
  await restarted.close();
});
