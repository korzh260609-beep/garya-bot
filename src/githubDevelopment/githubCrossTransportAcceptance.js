export const GH3_CROSS_TRANSPORT_ACCEPTANCE_CONTRACT_VERSION = 1;

function fail(code, message) {
  const error = new Error(message);
  error.name = 'GitHubCrossTransportAcceptanceError';
  error.code = code;
  throw error;
}

function required(value, field) {
  if (typeof value !== 'string' || value.trim() === '') fail('gh3-acceptance-input-invalid', `${field} is required`);
  return value.trim();
}

function fullSha(value, field) {
  const normalized = required(value, field).toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalized)) fail('gh3-acceptance-sha-invalid', `${field} must be a full commit SHA`);
  return normalized;
}

function assert(condition, code, message) {
  if (!condition) fail(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function assertNoSecretMaterial(value, path = 'evidence') {
  if (!value || typeof value !== 'object') return;
  const sensitive = /^(token|accessToken|installationToken|privateKey|password|authorization|secret)$/i;
  for (const [key, child] of Object.entries(value)) {
    if (sensitive.test(key) && child != null && child !== '') fail('gh3-acceptance-secret-material', `secret material is forbidden at ${path}.${key}`);
    assertNoSecretMaterial(child, `${path}.${key}`);
  }
}

export function validateGitHubCrossTransportAcceptanceEvidence(evidence = {}) {
  assertNoSecretMaterial(evidence);
  const acceptanceId = required(evidence.acceptanceId, 'acceptanceId');
  const repository = required(evidence.repository, 'repository');
  const branch = required(evidence.branch, 'branch');

  assert(evidence.publicDiscovery?.qualified === true && evidence.publicDiscovery?.readOnly === true && evidence.publicDiscovery?.sourceClass === 'public', 'gh3-acceptance-public-discovery-invalid', 'public discovery must be qualified, public and read-only');
  assert(evidence.privateIsolation?.denied === true, 'gh3-acceptance-private-isolation-failed', 'unauthorized private repository access must fail closed');

  const taskId = required(evidence.task?.taskId, 'task.taskId');
  const actorGlobalUserId = required(evidence.task?.actorGlobalUserId, 'task.actorGlobalUserId');
  const projectScope = required(evidence.task?.projectScope, 'task.projectScope');
  const startTransport = required(evidence.task?.startTransport, 'task.startTransport');
  const continuationTransport = required(evidence.transportContinuation?.transport, 'transportContinuation.transport');
  assert(startTransport !== continuationTransport, 'gh3-acceptance-cross-transport-missing', 'continuation must use a different transport');
  assert(evidence.transportContinuation?.taskId === taskId, 'gh3-acceptance-task-continuity-failed', 'cross-transport continuation must retain the same task');
  assert(evidence.transportContinuation?.actorGlobalUserId === actorGlobalUserId && evidence.transportContinuation?.projectScope === projectScope, 'gh3-acceptance-scope-continuity-failed', 'cross-transport continuation must retain actor and project scope');

  const baselineSha = fullSha(evidence.baseline?.headSha, 'baseline.headSha');
  assert(evidence.baseline?.repository === repository && evidence.baseline?.branch === branch, 'gh3-acceptance-baseline-scope-mismatch', 'baseline repository/branch mismatch');
  assert(evidence.baseline?.canonicalDocsVerified === true, 'gh3-acceptance-docs-unverified', 'canonical docs must be verified before mutation');
  assert(evidence.baseline?.ci?.sha === baselineSha, 'gh3-acceptance-baseline-ci-sha-mismatch', 'baseline CI must be correlated to exact HEAD');

  const mutationSha = fullSha(evidence.mutation?.commitSha, 'mutation.commitSha');
  assert(evidence.mutation?.atomic === true && Array.isArray(evidence.mutation?.changedPaths) && evidence.mutation.changedPaths.length >= 2, 'gh3-acceptance-atomic-mutation-missing', 'acceptance mutation must be an atomic multi-file commit');
  assert(evidence.mutation?.baselineSha === baselineSha && evidence.mutation?.repository === repository && evidence.mutation?.branch === branch, 'gh3-acceptance-mutation-scope-mismatch', 'mutation must bind to the verified baseline and scope');
  assert(evidence.pullRequest?.headSha === mutationSha && Number.isInteger(evidence.pullRequest?.number) && evidence.pullRequest.number > 0, 'gh3-acceptance-pr-invalid', 'pull request must bind to the mutation commit');

  assert(evidence.failedCI?.sha === mutationSha && evidence.failedCI?.conclusion === 'failure' && evidence.failedCI?.actionableFailureLocated === true, 'gh3-acceptance-failed-ci-invalid', 'failed CI evidence must bind to the mutation SHA and expose an actionable failure');
  const repairedSha = fullSha(evidence.repair?.commitSha, 'repair.commitSha');
  assert(evidence.repair?.baselineSha === mutationSha && repairedSha !== mutationSha, 'gh3-acceptance-repair-invalid', 'repair commit must derive from the failed mutation SHA');
  assert(evidence.greenCI?.sha === repairedSha && evidence.greenCI?.conclusion === 'success', 'gh3-acceptance-green-ci-invalid', 'green CI must bind to the repaired exact HEAD');

  assert(evidence.restartResume?.taskId === taskId && evidence.restartResume?.reconciledLiveState === true, 'gh3-acceptance-restart-reconciliation-failed', 'restart resume must reconcile the same durable task against live GitHub state');
  assert(Number(evidence.restartResume?.duplicateCommits ?? -1) === 0 && Number(evidence.restartResume?.duplicatePullRequests ?? -1) === 0 && Number(evidence.restartResume?.duplicateWorkflowDispatches ?? -1) === 0, 'gh3-acceptance-restart-duplicate', 'restart must not duplicate external GitHub actions');

  assert(evidence.protectedOperation?.allowed === false && evidence.protectedOperation?.separateConfirmationRequired === true, 'gh3-acceptance-protected-operation-not-gated', 'protected operation must remain separately gated');
  assert(evidence.idempotency?.duplicateExternalActions === false, 'gh3-acceptance-idempotency-failed', 'acceptance must prove no duplicate external actions');
  assert(evidence.secretSafety?.leaked === false, 'gh3-acceptance-secret-safety-failed', 'acceptance must prove secret-safe evidence');

  assert(evidence.developmentEvidence?.codeQualified === true && evidence.developmentEvidence?.ciQualified === true, 'gh3-acceptance-development-evidence-unqualified', 'PDK4 evidence must contain code and exact-head CI qualification');
  assert(evidence.developmentEvidence?.pm3CandidateStatus === 'proposed' && evidence.developmentEvidence?.pm3Confirmed === false, 'gh3-acceptance-pm3-promotion-invalid', 'PM3 projection must remain proposed and unconfirmed');
  assert(evidence.developmentEvidence?.deployedClaim === false && evidence.developmentEvidence?.liveVerifiedClaim === false, 'gh3-acceptance-lifecycle-promotion-invalid', 'repository/CI evidence must not claim deployed or live-verified state');

  return freeze({
    contractVersion: GH3_CROSS_TRANSPORT_ACCEPTANCE_CONTRACT_VERSION,
    accepted: true,
    acceptanceId,
    repository,
    branch,
    taskId,
    actorGlobalUserId,
    projectScope,
    baselineSha,
    mutationSha,
    repairedSha,
    startTransport,
    continuationTransport,
    evidence: freeze(structuredClone(evidence))
  });
}

export function createGitHubCrossTransportAcceptanceRunner({ scenario, clock = () => new Date() } = {}) {
  const steps = ['discoverPublic', 'provePrivateIsolation', 'startTask', 'verifyBaseline', 'mutateAndOpenPullRequest', 'observeFailedCI', 'repairAndReachGreen', 'restartAndResume', 'continueFromSecondTransport', 'proveProtectedDenial', 'ingestDevelopmentEvidence', 'proveSecretSafety'];
  for (const step of steps) if (typeof scenario?.[step] !== 'function') throw new TypeError(`scenario.${step} is required`);
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');

  async function run(input = {}) {
    const context = freeze({
      acceptanceId: required(input.acceptanceId, 'acceptanceId'),
      repository: required(input.repository, 'repository'),
      branch: required(input.branch, 'branch'),
      actorGlobalUserId: required(input.actorGlobalUserId, 'actorGlobalUserId'),
      projectScope: required(input.projectScope, 'projectScope'),
      startTransport: required(input.startTransport, 'startTransport'),
      continuationTransport: required(input.continuationTransport, 'continuationTransport')
    });
    assert(context.startTransport !== context.continuationTransport, 'gh3-acceptance-cross-transport-missing', 'acceptance requires two distinct transports');

    const publicDiscovery = await scenario.discoverPublic(context);
    const privateIsolation = await scenario.provePrivateIsolation(context);
    const task = await scenario.startTask(context);
    const baseline = await scenario.verifyBaseline(context, task);
    const mutationResult = await scenario.mutateAndOpenPullRequest(context, task, baseline);
    const failedCI = await scenario.observeFailedCI(context, task, mutationResult);
    const repairResult = await scenario.repairAndReachGreen(context, task, mutationResult, failedCI);
    const restartResume = await scenario.restartAndResume(context, task, repairResult);
    const transportContinuation = await scenario.continueFromSecondTransport(context, task, restartResume);
    const protectedOperation = await scenario.proveProtectedDenial(context, task);
    const developmentEvidence = await scenario.ingestDevelopmentEvidence(context, task, repairResult);
    const secretSafety = await scenario.proveSecretSafety(context, task);

    return validateGitHubCrossTransportAcceptanceEvidence({
      acceptanceId: context.acceptanceId,
      repository: context.repository,
      branch: context.branch,
      publicDiscovery,
      privateIsolation,
      task: { ...task, actorGlobalUserId: context.actorGlobalUserId, projectScope: context.projectScope, startTransport: context.startTransport },
      baseline,
      mutation: mutationResult.mutation,
      pullRequest: mutationResult.pullRequest,
      failedCI,
      repair: repairResult.repair,
      greenCI: repairResult.greenCI,
      restartResume,
      transportContinuation,
      protectedOperation,
      idempotency: { duplicateExternalActions: restartResume.duplicateCommits > 0 || restartResume.duplicatePullRequests > 0 || restartResume.duplicateWorkflowDispatches > 0 },
      secretSafety,
      developmentEvidence,
      completedAt: clock().toISOString()
    });
  }

  return Object.freeze({ run });
}
