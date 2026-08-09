import { randomUUID } from 'node:crypto';
import { createDiagnosticReport } from './contracts.js';
import { createExpectedPathRegistry } from './pathRegistry.js';
import { analyzeRootCause, buildFindings, downstreamEffects, findFirstDivergence, isTraceInFlight, reconstructTrace } from './analyzer.js';
import { evaluateTraceInvariants } from './invariants.js';
import { liveResultEvidence } from './liveRunner.js';

function rootCauseFromFinding(finding) {
  if (!finding) return null;
  return Object.freeze({
    errorClass: finding.errorClass,
    component: finding.component,
    confidence: finding.confidence,
    summary: finding.summary,
    evidenceIds: finding.evidenceIds,
    data: finding.data
  });
}

export function createDiagnosticService({
  store,
  observabilitySource,
  deploymentSource = null,
  infrastructureSource = null,
  liveRunner = null,
  pathRegistry = createExpectedPathRegistry(),
  environment = 'unknown',
  revision = 'unknown',
  inFlightGraceMs = 300000,
  clock = () => new Date().toISOString(),
  idFactory = randomUUID
} = {}) {
  if (!store?.createRun || !store?.addEvidence || !store?.completeRun) throw new TypeError('diagnostic store is required');
  if (!observabilitySource?.collect) throw new TypeError('observability evidence source is required');

  async function recentTraces({ globalUserId = null, projectScope = null, limit = 20 } = {}) {
    if (!observabilitySource?.recentTraces) throw Object.assign(new Error('Recent trace discovery is not configured'), { code: 'recent-trace-discovery-unavailable' });
    return observabilitySource.recentTraces({ globalUserId, projectScope, limit });
  }

  async function analyzeRequest({ traceId = null, requestId = null, pathId = null, includeDeployment = true } = {}) {
    if (!traceId && !requestId) throw new TypeError('traceId or requestId is required');
    const runId = idFactory();
    await store.createRun({ runId, mode: 'request', traceId, requestId, environment, revision, input: { pathId, includeDeployment } });
    try {
      const raw = await observabilitySource.collect({ traceId, requestId });
      const evidence = [];
      for (const item of raw) evidence.push(await store.addEvidence(runId, item));
      let deploymentFindings = [];
      if (includeDeployment && deploymentSource) {
        const deployment = await deploymentSource.collect();
        const persistedDeployment = [];
        for (const item of deployment.evidence) persistedDeployment.push(await store.addEvidence(runId, item));
        evidence.push(...persistedDeployment);
        deploymentFindings = [...deploymentSource.evaluate(persistedDeployment, deployment.expectedRevision)];
      }

      const selectedPathId = pathId ?? pathRegistry.infer(evidence.filter((item) => item.source === 'sg-observability'));
      const expectedPath = pathRegistry.get(selectedPathId);
      const traceEvidence = evidence.filter((item) => item.source === 'sg-observability');
      const trace = reconstructTrace({ expectedPath, evidence: traceEvidence });
      const firstDivergence = findFirstDivergence(trace);
      const invariantFindings = [...evaluateTraceInvariants(trace)];
      const nowMs = Date.parse(clock());
      const inFlight = invariantFindings.length === 0 && isTraceInFlight(trace, firstDivergence, { nowMs: Number.isFinite(nowMs) ? nowMs : Date.now(), graceMs: inFlightGraceMs });
      const confirmedInvariant = invariantFindings.find((item) => item.confidence === 'CONFIRMED');
      const rootCause = inFlight
        ? null
        : rootCauseFromFinding(deploymentFindings.find((item) => item.kind === 'deployment-mismatch' && item.confidence === 'CONFIRMED'))
          ?? rootCauseFromFinding(confirmedInvariant)
          ?? analyzeRootCause({ trace, firstDivergence, deploymentFindings });
      const baseFindings = inFlight ? [...deploymentFindings] : [...buildFindings({ trace, firstDivergence, rootCause, deploymentFindings })];
      const findings = Object.freeze([...baseFindings, ...invariantFindings.filter((item) => !baseFindings.some((existing) => existing.findingId === item.findingId))]);
      await store.saveFindings(runId, findings);

      const unknowns = [];
      if (traceEvidence.length === 0) unknowns.push('No matching SG observability evidence was found.');
      if (includeDeployment && !deploymentSource) unknowns.push('Deployment evidence source is not configured.');
      if (inFlight) unknowns.push(`Trace is still within the ${inFlightGraceMs}ms in-flight grace window; missing later stages are not classified as failures yet.`);
      const status = inFlight ? 'in-flight' : rootCause && rootCause.data?.expectedControlOutcome ? 'controlled' : rootCause ? 'failed' : firstDivergence ? 'degraded' : 'healthy';
      const report = createDiagnosticReport({
        runId, mode: 'request', status, traceId, requestId, environment, revision,
        expectedPathId: expectedPath.id, firstDivergence, rootCause,
        downstreamEffects: inFlight ? [] : downstreamEffects(trace, firstDivergence),
        findings, evidenceCount: evidence.length, unknowns, generatedAt: clock()
      });
      await store.completeRun({ runId, status, report });
      return Object.freeze({ report, trace, evidence: Object.freeze(evidence) });
    } catch (error) {
      const report = createDiagnosticReport({ runId, mode: 'request', status: 'diagnostics-failed', traceId, requestId, environment, revision, evidenceCount: 0, unknowns: [error.message], generatedAt: clock() });
      await store.completeRun({ runId, status: 'diagnostics-failed', report });
      throw error;
    }
  }

  async function systemHealth() {
    const runId = idFactory();
    await store.createRun({ runId, mode: 'system', environment, revision, input: {} });
    const evidence = [];
    const findings = [];
    try {
      if (infrastructureSource) for (const item of await infrastructureSource.collect()) evidence.push(await store.addEvidence(runId, item));
      if (deploymentSource) {
        const deployment = await deploymentSource.collect();
        const deploymentEvidence = [];
        for (const item of deployment.evidence) deploymentEvidence.push(await store.addEvidence(runId, item));
        evidence.push(...deploymentEvidence);
        findings.push(...deploymentSource.evaluate(deploymentEvidence, deployment.expectedRevision));
      }
      const failed = evidence.filter((item) => ['failed', 'timeout'].includes(item.status));
      const status = findings.some((item) => item.confidence === 'CONFIRMED') || failed.length ? 'degraded' : 'healthy';
      await store.saveFindings(runId, findings);
      const report = createDiagnosticReport({ runId, mode: 'system', status, environment, revision, rootCause: rootCauseFromFinding(findings.find((item) => item.kind === 'deployment-mismatch')) ?? null, findings, evidenceCount: evidence.length, unknowns: deploymentSource ? [] : ['Deployment evidence source is not configured.'], generatedAt: clock() });
      await store.completeRun({ runId, status, report });
      return Object.freeze({ report, evidence: Object.freeze(evidence) });
    } catch (error) {
      const report = createDiagnosticReport({ runId, mode: 'system', status: 'diagnostics-failed', environment, revision, evidenceCount: evidence.length, unknowns: [error.message], generatedAt: clock() });
      await store.completeRun({ runId, status: 'diagnostics-failed', report });
      throw error;
    }
  }

  async function runLive({ probeIds = undefined } = {}) {
    if (!liveRunner) throw Object.assign(new Error('Live diagnostic runner is not configured'), { code: 'live-runner-not-configured' });
    const runId = idFactory();
    await store.createRun({ runId, mode: 'live', environment, revision, input: { probeIds: probeIds ?? null } });
    const result = await liveRunner.run({ ...(probeIds ? { probeIds } : {}) });
    const evidence = [];
    for (const item of liveResultEvidence(result)) evidence.push(await store.addEvidence(runId, item));
    const status = result.failed ? 'degraded' : 'healthy';
    const report = createDiagnosticReport({ runId, mode: 'live', status, environment, revision, evidenceCount: evidence.length, unknowns: [], generatedAt: clock() });
    await store.completeRun({ runId, status, report });
    return Object.freeze({ report, result, evidence: Object.freeze(evidence) });
  }

  async function replayRegression(regression) {
    const fixtureEvidence = regression.fixture?.evidence ?? [];
    const expectedPath = pathRegistry.get(regression.fixture?.pathId ?? 'conversation');
    const trace = reconstructTrace({ expectedPath, evidence: fixtureEvidence });
    const firstDivergence = findFirstDivergence(trace);
    const invariantFindings = evaluateTraceInvariants(trace);
    const rootCause = rootCauseFromFinding(invariantFindings.find((item) => item.confidence === 'CONFIRMED')) ?? analyzeRootCause({ trace, firstDivergence });
    const expected = regression.expected ?? {};
    const passed = (expected.firstDivergenceStage == null || firstDivergence?.stage === expected.firstDivergenceStage)
      && (expected.errorClass == null || rootCause?.errorClass === expected.errorClass);
    return Object.freeze({ regressionId: regression.regression_id ?? regression.regressionId, passed, firstDivergence, rootCause, invariantFindings });
  }

  async function runRegressions() {
    const regressions = await store.listRegressions({ enabledOnly: true });
    const results = [];
    for (const regression of regressions) results.push(await replayRegression(regression));
    return Object.freeze({ total: results.length, passed: results.filter((item) => item.passed).length, failed: results.filter((item) => !item.passed).length, results: Object.freeze(results) });
  }

  return Object.freeze({ analyzeRequest, recentTraces, systemHealth, runLive, runRegressions, replayRegression });
}