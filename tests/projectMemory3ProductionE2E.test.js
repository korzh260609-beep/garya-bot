import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence, runMigrations } from '../src/persistence/index.js';
import { createLocalProductionHarness } from '../src/runtime/localProductionHarness.js';
import { createOwnerSecurityGateway } from '../src/security/ownerSecurity.js';
import {
  createGitHubCommitVerifier,
  createProjectMemoryIngestionBoundary,
  createPostgresProjectMemoryStore,
  createProjectMemoryDedupConflictResolver,
  createProjectMemoryConfirmationControl,
  createProjectMemoryConfirmationPolicy,
  createProjectMemoryTemporalHistory,
  createProjectMemoryHybridRetrieval,
  createProjectMemoryContextGuard,
  createTrustedProjectEvent,
  createProjectMemoryProductionAcceptanceReport
} from '../src/projectMemory/index.js';

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;
const MONARCH = 'usr_48cc07c069030fb3';
const REPOSITORY = 'korzh260609-beep/garya-bot';
const SHA1 = '1111111111111111111111111111111111111111';
const SHA2 = '2222222222222222222222222222222222222222';

function githubFetch(sha) {
  return async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        sha,
        html_url: `https://github.com/${REPOSITORY}/commit/${sha}`,
        commit: { committer: { date: sha === SHA1 ? '2026-08-10T14:00:00Z' : '2026-08-10T14:10:00Z' } },
        author: { login: 'korzh260609-beep' }
      };
    }
  });
}

function trustedRawEvent({ projectKey, sha, eventId, status, summary, occurredAt }) {
  return {
    projectKey,
    sourceKind: 'github',
    sourceRef: `github:${REPOSITORY}@${sha}`,
    sourceEventId: eventId,
    occurredAt,
    traceId: `trace:${eventId}`,
    evidence: { repository: REPOSITORY, commitSha: sha },
    candidate: {
      domain: 'features',
      factType: 'feature-status',
      entityKey: 'pm3.12',
      fact: { status, summary },
      tags: ['pm3.12', 'production-e2e'],
      metadata: { acceptance: 'pm3.12' }
    }
  };
}

function ownerContext(projectKey) {
  return {
    actor: { globalUserId: MONARCH, kind: 'user' },
    scope: { projectScope: projectKey },
    traceContext: { traceId: `owner:${projectKey}`, requestId: `owner-request:${projectKey}` }
  };
}

function ownerGateway() {
  return createOwnerSecurityGateway({
    config: { monarchGlobalUserId: MONARCH, lockdown: false, failureWindowMs: 60000, maxFailuresPerWindow: 10 },
    clock: () => new Date('2026-08-10T14:20:00Z')
  });
}

integration('PM3.12: production E2E proves trusted source -> durable memory -> restart -> normal SG answer', async () => {
  const projectKey = `pm312-${randomUUID().slice(0, 8)}`;
  const first = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pm3.12-e2e-setup' });
  await first.start();
  await runMigrations(first.database);
  const store = createPostgresProjectMemoryStore(first.database);
  const resolver = createProjectMemoryDedupConflictResolver({ store, database: first.database, ownerSecurityGateway: ownerGateway(), clock: () => new Date('2026-08-10T14:20:00Z') });
  const control = createProjectMemoryConfirmationControl({ store, ownerSecurityGateway: ownerGateway(), policy: createProjectMemoryConfirmationPolicy(), clock: () => new Date('2026-08-10T14:20:00Z') });
  const temporal = createProjectMemoryTemporalHistory({ store, database: first.database, clock: () => new Date('2026-08-10T14:20:00Z') });

  const boundary1 = createProjectMemoryIngestionBoundary({ githubVerifier: createGitHubCommitVerifier({ fetchImpl: githubFetch(SHA1), allowedRepositories: [REPOSITORY] }) });
  const accepted1 = await boundary1.ingest(trustedRawEvent({ projectKey, sha: SHA1, eventId: `pm312:${projectKey}:v1`, status: 'implemented', summary: 'PM3.12 implementation baseline is stored.', occurredAt: '2026-08-10T14:00:00Z' }));
  assert.equal(accepted1.verification.verified, true);
  const stored1 = await resolver.ingest(accepted1.candidate);
  assert.equal(stored1.status, 'stored');
  const replay = await resolver.ingest(accepted1.candidate);
  assert.equal(replay.status, 'duplicate');
  assert.equal(replay.duplicateKind, 'source-event');
  await control.confirm({ memoryId: stored1.record.memoryId, projectKey, actionContext: ownerContext(projectKey), reason: 'PM3.12 verified source accepted' });

  const boundary2 = createProjectMemoryIngestionBoundary({ githubVerifier: createGitHubCommitVerifier({ fetchImpl: githubFetch(SHA2), allowedRepositories: [REPOSITORY] }) });
  const accepted2 = await boundary2.ingest(trustedRawEvent({ projectKey, sha: SHA2, eventId: `pm312:${projectKey}:v2`, status: 'closed', summary: 'PM3.12 Production E2E & Live Acceptance is CLOSED and CI-verified.', occurredAt: '2026-08-10T14:10:00Z' }));
  const stored2 = await resolver.ingest(accepted2.candidate);
  assert.equal(stored2.status, 'conflict');
  assert.ok(stored2.conflicts.length >= 1);
  await control.confirm({ memoryId: stored2.record.memoryId, projectKey, actionContext: ownerContext(projectKey), reason: 'newer verified PM3.12 evidence accepted' });
  const supersession = await temporal.supersede({ projectKey, currentMemoryId: stored1.record.memoryId, successorMemoryId: stored2.record.memoryId, effectiveAt: '2026-08-10T14:10:00Z' });
  assert.equal(supersession.status, 'superseded');

  const auth = ({ actor, projectKey: p, operation }) => actor?.projects?.includes(p) === true && ['read', 'context-read'].includes(operation);
  const retrieval = createProjectMemoryHybridRetrieval({ database: first.database, store, authorize: auth, clock: () => new Date('2026-08-10T14:30:00Z') });
  const guard = createProjectMemoryContextGuard({ database: first.database, authorize: auth, retrieval, clock: () => new Date('2026-08-10T14:30:00Z') });
  const preRestart = await retrieval.search({ actor: { projects: [projectKey] }, projectKey, query: 'PM3.12 Production E2E Live Acceptance', limit: 5 });
  assert.equal(preRestart.results.some((item) => item.record.memoryId === stored1.record.memoryId), false);
  assert.equal(preRestart.results.some((item) => item.record.memoryId === stored2.record.memoryId), true);
  const guarded = await guard.build({ actor: { projects: [projectKey] }, projectKey, retrievalResult: preRestart });
  assert.equal(guarded.facts.length, 1);
  assert.equal(guarded.facts[0].conflict.open, true);
  assert.equal(guarded.facts[0].provenance.sourceKind, 'github');
  await first.close();

  const harness = createLocalProductionHarness({
    env: { SG_PERSISTENCE_MODE: 'postgres', DATABASE_URL: connectionString, DATABASE_SSL: 'false', SG_PROJECT_SCOPE: projectKey, SG_REVISION: 'pm3.12-production-e2e' },
    clock: () => new Date('2026-08-10T14:30:00Z')
  });
  await harness.runtime.start();
  let runtimeResult;
  try {
    const afterRestart = await harness.projectMemoryStore.get(stored2.record.memoryId, { projectKey });
    assert.equal(afterRestart.memoryId, stored2.record.memoryId);
    runtimeResult = await harness.transport.send({ text: 'What is the current PM3.12 status?', locale: 'en', userId: 'pm312-user', projectId: projectKey });
    assert.equal(runtimeResult.response.status, 'success');
    const rendered = JSON.stringify(runtimeResult.response);
    assert.match(rendered, /PM3\.12 Production E2E & Live Acceptance is CLOSED and CI-verified/);
    assert.match(rendered, /github:/);
    assert.match(rendered, /live state was not independently re-verified/i);
    assert.doesNotMatch(rendered, /PM3\.12 implementation baseline is stored/);
  } finally {
    await harness.runtime.stop();
  }

  assert.throws(() => createTrustedProjectEvent({ projectKey, sourceKind: 'chat', sourceRef: 'chat:1', sourceEventId: 'chat:1', occurredAt: '2026-08-10T14:30:00Z', evidence: {}, candidate: {} }), (error) => error.code === 'project-memory-source-chat-unavailable');
  assert.throws(() => createTrustedProjectEvent({ projectKey, sourceKind: 'render', sourceRef: 'render:service', sourceEventId: 'render:1', occurredAt: '2026-08-10T14:30:00Z', evidence: {}, candidate: {} }), (error) => error.code === 'project-memory-source-render-unavailable');

  const acceptance = createProjectMemoryProductionAcceptanceReport({
    trustedSourceVerified: accepted1.verification.verified === true && accepted2.verification.verified === true,
    durableWrite: Boolean(stored1.record.memoryId && stored2.record.memoryId),
    restartContinuity: true,
    hybridRetrieval: preRestart.results.some((item) => item.record.memoryId === stored2.record.memoryId),
    contextGuard: guarded.kind === 'ProjectMemoryContext' && guarded.facts[0]?.dataOnly === true,
    normalRequestUsedProjectMemory: JSON.stringify(runtimeResult.response).includes('PM3.12 Production E2E & Live Acceptance is CLOSED'),
    provenancePresent: JSON.stringify(runtimeResult.response).includes('github:'),
    currentnessQualified: /live state was not independently re-verified/i.test(JSON.stringify(runtimeResult.response)),
    replayIdempotent: replay.status === 'duplicate',
    conflictsVisible: guarded.conflictSummary.factsWithOpenConflicts >= 1,
    rawChatSelfConfirmBlocked: true,
    renderLiveSourceBlocked: true,
    supersededFactExcluded: !preRestart.results.some((item) => item.record.memoryId === stored1.record.memoryId),
    runtimeRevision: 'pm3.12-production-e2e',
    sourceKind: 'github',
    sourceVerification: 'immutable-commit-verifier',
    retrievalMode: preRestart.semanticMode,
    contextKind: guarded.kind,
    answerPath: 'normal-runtime-compose-answer',
    replayOutcome: replay.duplicateKind,
    conflictOutcome: stored2.status,
    supersessionOutcome: supersession.status
  });
  assert.equal(acceptance.accepted, true);
  assert.deepEqual(acceptance.failedCriteria, []);
  assert.equal(acceptance.evidence.rawMemoryIncluded, false);

  const cleanup = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'pm3.12-e2e-cleanup' });
  await cleanup.start();
  try { await cleanup.database.query("DELETE FROM memory_records WHERE project_scope=$1 AND memory_layer='project-memory'", [projectKey]); }
  finally { await cleanup.close(); }
});

test('PM3.12: acceptance contract fails closed when any production criterion is missing', () => {
  const report = createProjectMemoryProductionAcceptanceReport({ trustedSourceVerified: true });
  assert.equal(report.accepted, false);
  assert.equal(report.status, 'rejected');
  assert.ok(report.failedCriteria.includes('restartContinuity'));
  assert.equal(report.evidence.rawMemoryIncluded, false);
  assert.equal(report.evidence.secretMaterialIncluded, false);
});
