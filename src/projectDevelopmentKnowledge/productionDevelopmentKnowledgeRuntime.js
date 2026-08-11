import { randomUUID } from 'node:crypto';
import { createGitHubHistoricalScanner } from './githubHistoricalScanner.js';
import { createPostgresHistoricalCursorStore } from './postgresHistoricalCursorStore.js';
import { createGitHubDevelopmentHistorySource } from './githubDevelopmentHistorySource.js';
import { createGitHubDevelopmentSourceVerifier } from './githubDevelopmentSourceVerifier.js';
import { createDevelopmentSourceNormalizer } from './sourceNormalizationVerification.js';
import { createDevelopmentSignificanceClassifier } from './developmentSignificanceClassifier.js';
import { createDevelopmentEventExtractor } from './developmentEventExtractor.js';
import { createIncrementalDevelopmentKnowledgeProcessor } from './incrementalDevelopmentKnowledgeProcessor.js';
import { createContinuousGitHubIngestion } from './continuousGitHubIngestion.js';
import { createPostgresContinuousIngestionStore } from './postgresContinuousIngestionStore.js';
import { createPostgresDevelopmentKnowledgeSingleFlight } from './postgresDevelopmentKnowledgeSingleFlight.js';
import { createDevelopmentKnowledgeDiagnostics } from './developmentKnowledgeDiagnostics.js';

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function errorCode(error) { return String(error?.code ?? 'pdk4-production-ingestion-failed').slice(0, 160); }
function iso(clock) { const value = clock(); return new Date(value?.toISOString?.() ?? value).toISOString(); }

export const PDK4_PRODUCTION_RUNTIME_CONTRACT_VERSION = 1;

export function createProductionDevelopmentKnowledgeRuntime({
  config,
  database,
  projectMemoryStore,
  credentialManager,
  credentialAccessContext,
  aiRouter = null,
  fetchImpl = globalThis.fetch,
  observability = null,
  clock = () => new Date(),
  ownerId = `pdk4:${randomUUID()}`
} = {}) {
  if (!config || typeof config !== 'object') throw new TypeError('PDK4 production config is required');
  if (!database?.query || !database?.transaction) throw new TypeError('started PostgreSQL database is required');
  if (!projectMemoryStore?.put) throw new TypeError('projectMemoryStore.put is required');
  if (!credentialManager?.useCredential) throw new TypeError('credentialManager.useCredential is required');
  if (!credentialAccessContext?.actor || !credentialAccessContext?.scope) throw new TypeError('credentialAccessContext is required');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');

  const projectKey = required(config.projectKey, 'config.projectKey').toLowerCase();
  const repository = required(config.repository, 'config.repository').toLowerCase();
  const branch = required(config.branch, 'config.branch');
  const credentialId = required(config.credentialId, 'config.credentialId');
  const batchSize = Number(config.batchSize);
  const maxCommitsPerRun = Number(config.maxCommitsPerRun);
  const pollIntervalMs = Number(config.pollIntervalMs);
  const requestTimeoutMs = Number(config.requestTimeoutMs);
  const leaseDurationMs = Math.max(15000, Math.min(3600000, requestTimeoutMs * 4 + batchSize * 250));

  const historyCursorStore = createPostgresHistoricalCursorStore(database);
  const ingestionStateStore = createPostgresContinuousIngestionStore(database);
  const singleFlight = createPostgresDevelopmentKnowledgeSingleFlight(database, { defaultLeaseMs: leaseDurationMs });

  async function observe(eventType, data = {}, outcome = 'success') {
    if (typeof observability?.record !== 'function') return;
    await observability.record({
      eventClass: 'audit_event', channel: 'telemetry', stage: 'pdk4-production', outcome,
      traceContext: { traceId: `pdk4:${ownerId}`, requestId: `pdk4:${eventType}:${ownerId}`, environment: 'production', revision: 'runtime' },
      data: { pdk4Event: eventType, projectKey, repository, ...data }
    });
  }

  async function headersProvider() {
    return credentialManager.useCredential({
      credentialId,
      actor: credentialAccessContext.actor,
      scope: credentialAccessContext.scope,
      purpose: 'pdk4.github.read',
      connectionId: 'github-pdk4',
      operation: async (token) => Object.freeze({ Authorization: `Bearer ${token}` })
    });
  }

  async function boundedFetch(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    timer.unref?.();
    try {
      return await fetchImpl(url, { ...options, signal: options.signal ?? controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  const githubSource = createGitHubDevelopmentHistorySource({ fetchImpl: boundedFetch, allowedRepositories: [repository], branch, headersProvider });
  const githubVerifier = createGitHubDevelopmentSourceVerifier({ fetchImpl: boundedFetch, allowedRepositories: [repository], headersProvider });
  const sourceNormalizer = createDevelopmentSourceNormalizer({ githubVerifier, approvedRepositories: [repository] });
  const classifier = createDevelopmentSignificanceClassifier({ aiRouter });
  const extractor = createDevelopmentEventExtractor({ aiRouter, clock });

  function verifiedCandidate(candidate, context) {
    const commitSha = required(context.commitSha, 'commitSha').toLowerCase();
    const sourceRef = `github:${repository}@${commitSha}`;
    return {
      ...candidate,
      source: { kind: 'github', ref: sourceRef, timestamp: context.normalizedSource.occurredAt },
      trust: 'verified',
      confirmed: false,
      confirmationState: 'proposed',
      metadata: {
        ...(candidate.metadata ?? {}),
        pdk4AutonomousIngestion: true,
        pdk4SourceVerified: true,
        pdk4Repository: repository,
        pdk4CommitSha: commitSha,
        pdk4NormalizedFingerprint: context.normalizedSource.normalizedFingerprint
      }
    };
  }

  const processor = createIncrementalDevelopmentKnowledgeProcessor({
    sourceNormalizer,
    classifier,
    extractor,
    projectMemoryStore,
    projectMemoryCandidateProjector: verifiedCandidate
  });

  const historicalScanner = createGitHubHistoricalScanner({
    historySource: githubSource,
    cursorStore: historyCursorStore,
    onSource: async ({ source }) => processor.processCommit({
      projectKey,
      repository,
      commitSha: source.sha,
      triggerId: `bootstrap:${source.sha}`,
      triggerType: 'event'
    })
  });

  const continuous = createContinuousGitHubIngestion({
    historyCursorStore,
    ingestionStateStore,
    githubSource,
    processCommit: (input) => processor.processCommit(input),
    observability: { record: (type, payload) => observe(type, payload) },
    clock
  });

  const diagnostics = createDevelopmentKnowledgeDiagnostics({ database, historyCursorStore, ingestionStateStore, clock });

  let phase = config.enabled ? 'not-started' : 'disabled';
  let running = false;
  let timer = null;
  let lastSuccessAt = null;
  let lastAttemptAt = null;
  let lastError = null;
  let sequence = 0;

  function health() {
    return freeze({
      contractVersion: PDK4_PRODUCTION_RUNTIME_CONTRACT_VERSION,
      enabled: config.enabled === true,
      phase,
      healthy: config.enabled !== true || phase !== 'degraded',
      running,
      projectKey,
      repository,
      branch,
      lastSuccessAt,
      lastAttemptAt,
      lastErrorCode: lastError,
      pollIntervalMs,
      batchSize,
      maxCommitsPerRun
    });
  }

  async function renewLease() {
    const renewed = await singleFlight.renew({ projectKey, repository, ownerId, leaseDurationMs });
    if (!renewed.renewed) {
      const error = new Error('PDK4 single-flight lease was lost');
      error.code = 'pdk4-single-flight-lease-lost';
      throw error;
    }
  }

  async function reconcile({ reason = 'poll' } = {}) {
    if (config.enabled !== true) return freeze({ status: 'disabled', health: health() });
    if (running) return freeze({ status: 'already-running', health: health() });
    const lease = await singleFlight.acquire({ projectKey, repository, ownerId, leaseDurationMs });
    if (!lease.acquired) {
      await observe('pdk4_ingestion_skipped', { reason: 'single-flight-busy' }, 'skipped');
      return freeze({ status: 'single-flight-busy', health: health() });
    }

    running = true;
    lastAttemptAt = iso(clock);
    lastError = null;
    let processed = 0;
    let fetched = 0;
    let bootstrapBatches = 0;
    let incrementalBatches = 0;
    try {
      await observe('pdk4_ingestion_started', { reason });
      let cursor = await historyCursorStore.getCursor({ projectKey, sourceKind: 'github-commit', sourceScope: repository });
      phase = cursor?.status === 'complete' ? 'catching-up' : 'bootstrapping';

      while (cursor?.status !== 'complete' && processed < maxCommitsPerRun) {
        const result = await historicalScanner.scanBatch({ projectKey, repository, batchLimit: Math.min(batchSize, maxCommitsPerRun - processed) });
        bootstrapBatches += 1;
        processed += result.processed;
        fetched += result.fetched;
        cursor = result.cursor;
        await renewLease();
        if (result.status === 'complete') break;
        if (result.fetched === 0) break;
      }

      if (cursor?.status !== 'complete') {
        phase = 'bootstrapping';
        lastSuccessAt = iso(clock);
        await observe('pdk4_bootstrap_progress', { processed, fetched, bootstrapBatches });
        return freeze({ status: 'bootstrap-partial', processed, fetched, bootstrapBatches, incrementalBatches, health: health() });
      }

      phase = 'catching-up';
      while (processed < maxCommitsPerRun) {
        sequence += 1;
        const limit = Math.min(batchSize, maxCommitsPerRun - processed);
        const result = await continuous.poll({ projectKey, repository, batchLimit: limit, triggerId: `pdk4:${ownerId}:${sequence}:${Date.now()}` });
        incrementalBatches += 1;
        processed += result.processed ?? 0;
        fetched += result.fetched ?? 0;
        await renewLease();
        if (result.status === 'current') break;
        if ((result.fetched ?? 0) === 0) break;
      }

      const state = await ingestionStateStore.getState({ projectKey, repository });
      phase = 'current';
      lastSuccessAt = iso(clock);
      await observe('pdk4_ingestion_completed', { reason, processed, fetched, bootstrapBatches, incrementalBatches, lastCommitSha: state?.lastCommitSha ?? null });
      return freeze({ status: 'current', processed, fetched, bootstrapBatches, incrementalBatches, state, health: health() });
    } catch (error) {
      phase = 'degraded';
      lastError = errorCode(error);
      await observe('pdk4_ingestion_failed', { reason, errorCode: lastError }, 'failed');
      return freeze({ status: 'degraded', errorCode: lastError, processed, fetched, bootstrapBatches, incrementalBatches, health: health() });
    } finally {
      running = false;
      try { await singleFlight.release({ projectKey, repository, ownerId }); } catch {}
    }
  }

  async function inspect() {
    const report = await diagnostics.inspect({ projectKey, repository });
    const lease = await singleFlight.inspect({ projectKey, repository });
    return freeze({ ...report, productionRuntime: health(), singleFlight: lease ? { active: lease.active, leaseUntil: lease.leaseUntil } : null });
  }

  async function start() {
    if (config.enabled !== true) { phase = 'disabled'; return health(); }
    if (timer) return health();
    await reconcile({ reason: 'startup' });
    timer = setInterval(() => { reconcile({ reason: 'poll' }).catch(() => {}); }, pollIntervalMs);
    timer.unref?.();
    return health();
  }

  async function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    try { await singleFlight.release({ projectKey, repository, ownerId }); } catch {}
    running = false;
    phase = config.enabled ? 'stopped' : 'disabled';
    return health();
  }

  return Object.freeze({ start, stop, reconcile, inspect, health, historyCursorStore, ingestionStateStore, singleFlight, githubSource, githubVerifier, processor });
}
