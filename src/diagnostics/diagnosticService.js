import { randomUUID } from 'node:crypto';
import { createDiagnosticReport } from './contracts.js';
import { createExpectedPathRegistry } from './pathRegistry.js';
import { analyzeRootCause, buildFindings, downstreamEffects, findFirstDivergence, reconstructTrace } from './analyzer.js';

export function createDiagnosticService({
  store,
  observabilitySource,
  deploymentSource = null,
  pathRegistry = createExpectedPathRegistry(),
  environment = 'unknown',
  revision = 'unknown',
  clock = () => new Date().toISOString(),
  idFactory = randomUUID
} = {}) {
  if (!store?.createRun || !store?.addEvidence || !store?.completeRun) throw new TypeError('diagnostic store is required');
  if (!observabilitySource?.collect) throw new TypeError('observability evidence source is required');

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
      const rootCause = analyzeRootCause({ trace, firstDivergence, deploymentFindings });
      const findings = buildFindings({ trace, firstDivergence, rootCause, deploymentFindings });
      await store.saveFindings(runId, findings);

      const unknowns = [];
      if (traceEvidence.length === 0) unknowns.push('No matching SG observability evidence was found.');
      if (includeDeployment && !deploymentSource) unknowns.push('Deployment evidence source is not configured.');
      const status = rootCause && rootCause.data?.expectedControlOutcome ? 'controlled' : rootCause ? 'failed' : firstDivergence ? 'degraded' : 'healthy';
      const report = createDiagnosticReport({
        runId, mode: 'request', status, traceId, requestId, environment, revision,
        expectedPathId: expectedPath.id, firstDivergence, rootCause,
        downstreamEffects: downstreamEffects(trace, firstDivergence), findings,
        evidenceCount: evidence.length, unknowns, generatedAt: clock()
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
      if (deploymentSource) {
        const deployment = await deploymentSource.collect();
        for (const item of deployment.evidence) evidence.push(await store.addEvidence(runId, item));
        findings.push(...deploymentSource.evaluate(evidence, deployment.expectedRevision));
      }
      const failed = evidence.filter((item) => ['failed', 'timeout'].includes(item.status));
      const status = findings.some((item) => item.confidence === 'CONFIRMED') || failed.length ? 'degraded' : 'healthy';
      await store.saveFindings(runId, findings);
      const report = createDiagnosticReport({ runId, mode: 'system', status, environment, revision, rootCause: findings.find((item) => item.kind === 'deployment-mismatch') ?? null, findings, evidenceCount: evidence.length, unknowns: deploymentSource ? [] : ['Deployment evidence source is not configured.'], generatedAt: clock() });
      await store.completeRun({ runId, status, report });
      return Object.freeze({ report, evidence: Object.freeze(evidence) });
    } catch (error) {
      const report = createDiagnosticReport({ runId, mode: 'system', status: 'diagnostics-failed', environment, revision, evidenceCount: evidence.length, unknowns: [error.message], generatedAt: clock() });
      await store.completeRun({ runId, status: 'diagnostics-failed', report });
      throw error;
    }
  }

  async function replayRegression(regression) {
    const fixtureEvidence = regression.fixture?.evidence ?? [];
    const expectedPath = pathRegistry.get(regression.fixture?.pathId ?? 'conversation');
    const trace = reconstructTrace({ expectedPath, evidence: fixtureEvidence });
    const firstDivergence = findFirstDivergence(trace);
    const rootCause = analyzeRootCause({ trace, firstDivergence });
    const expected = regression.expected ?? {};
    const passed = (expected.firstDivergenceStage == null || firstDivergence?.stage === expected.firstDivergenceStage)
      && (expected.errorClass == null || rootCause?.errorClass === expected.errorClass);
    return Object.freeze({ regressionId: regression.regression_id ?? regression.regressionId, passed, firstDivergence, rootCause });
  }

  async function runRegressions() {
    const regressions = await store.listRegressions({ enabledOnly: true });
    const results = [];
    for (const regression of regressions) results.push(await replayRegression(regression));
    return Object.freeze({ total: results.length, passed: results.filter((item) => item.passed).length, failed: results.filter((item) => !item.passed).length, results: Object.freeze(results) });
  }

  return Object.freeze({ analyzeRequest, systemHealth, runRegressions, replayRegression });
}
