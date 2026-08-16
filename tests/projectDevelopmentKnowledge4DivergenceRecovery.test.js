import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresHistoricalCursorStore } from '../src/projectDevelopmentKnowledge/postgresHistoricalCursorStore.js';
import { createPostgresContinuousIngestionStore } from '../src/projectDevelopmentKnowledge/postgresContinuousIngestionStore.js';

const PROJECT = 'sg2.1';
const REPOSITORY = 'korzh260609-beep/garya-bot';
const SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SOURCE_ID = `github:${REPOSITORY}:commit:${SHA}`;

test('PDK4.13 recovery dedupe includes historical and continuous processed sources', async () => {
  let sql = '';
  const database = {
    async query(statement) {
      sql = statement;
      return { rowCount: 1, rows: [{ source_id: SOURCE_ID }] };
    },
    async transaction(fn) { return fn(this); }
  };
  const store = createPostgresHistoricalCursorStore(database);
  const result = await store.listProcessedSourceIds({ projectKey: PROJECT, sourceScope: REPOSITORY, sourceIds: [SOURCE_ID] });
  assert.deepEqual(result, [SOURCE_ID]);
  assert.match(sql, /pdk4_processed_sources/);
  assert.match(sql, /pdk4_continuous_processed_sources/);
  assert.match(sql, /UNION/);
});

test('PDK4.13 continuous reanchor preserves counters while moving branch anchor', async () => {
  const state = {
    project_key: PROJECT,
    repository: REPOSITORY,
    bootstrap_last_source_id: 'github:korzh260609-beep/garya-bot:commit:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    last_source_id: 'github:korzh260609-beep/garya-bot:commit:cccccccccccccccccccccccccccccccccccccccc',
    last_commit_sha: 'cccccccccccccccccccccccccccccccccccccccc',
    processed_count: 17,
    last_processed_at: null,
    created_at: '2026-08-16T00:00:00.000Z',
    updated_at: '2026-08-16T00:00:00.000Z'
  };
  const database = {
    async transaction(fn) { return fn(this); },
    async query(statement, params = []) {
      if (/INSERT INTO pdk4_continuous_ingestion_state/.test(statement)) {
        state.bootstrap_last_source_id = params[2];
        state.last_source_id = params[2];
        state.last_commit_sha = params[3];
        return { rowCount: 1, rows: [] };
      }
      if (/SELECT \* FROM pdk4_continuous_ingestion_state/.test(statement)) return { rowCount: 1, rows: [state] };
      return { rowCount: 1, rows: [{ project_key: PROJECT }] };
    }
  };
  const store = createPostgresContinuousIngestionStore(database);
  const result = await store.reanchorState({ projectKey: PROJECT, repository: REPOSITORY, bootstrapLastSourceId: SOURCE_ID, bootstrapLastCommitSha: SHA });
  assert.equal(result.bootstrapLastSourceId, SOURCE_ID);
  assert.equal(result.lastSourceId, SOURCE_ID);
  assert.equal(result.lastCommitSha, SHA);
  assert.equal(result.processedCount, 17);
});
