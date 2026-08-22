import { createHash } from 'node:crypto';
import { createGitHubRepositoryIdentity } from './githubDevelopmentContract.js';

const SHA = /^[0-9a-f]{40}$/u;
const OPERATIONS = new Set(['github.repository.read','github.code.search','github.contents.write','github.commit.create']);
function fail(code, message) { const error = new Error(message); error.name = 'GitHubCanonicalExecutionBridgeError'; error.code = code; throw error; }
function text(value, field, max = 10000) { if (typeof value !== 'string' || !value.trim()) fail('gde3-input-invalid', `${field} is required`); const normalized = value.trim(); if (normalized.length > max) fail('gde3-input-invalid', `${field} is too large`); return normalized; }
function list(value, field, max = 100) { if (!Array.isArray(value) || value.length > max) fail('gde3-change-set-invalid', `${field} must be a bounded array`); return [...new Set(value.map((item) => text(item, `${field} item`, 500)))]; }
function safePaths(value, field) { return list(value ?? [], field).map((path) => { if (path.startsWith('/') || path.split('/').includes('..')) fail('gde3-change-set-invalid', `${field} contains unsafe path`); return path; }); }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }
function taskId(input) { return `gde3-${createHash('sha256').update([input.identityContext.globalUserId,input.scopeContext.projectScope,input.traceContext.requestId].join('|')).digest('hex').slice(0,24)}`; }

function plan(input = {}) {
  const result = {
    filesToRead: safePaths(input.filesToRead, 'filesToRead'),
    filesToCreate: safePaths(input.filesToCreate, 'filesToCreate'),
    filesToModify: safePaths(input.filesToModify, 'filesToModify'),
    filesToDelete: safePaths(input.filesToDelete, 'filesToDelete'),
    tests: safePaths(input.tests, 'tests'),
    docs: safePaths(input.docs, 'docs'),
    migrations: safePaths(input.migrations, 'migrations'),
    expectedPostConditions: list(input.expectedPostConditions ?? [], 'expectedPostConditions', 30)
  };
  const mutationPaths = [...result.filesToCreate,...result.filesToModify,...result.filesToDelete];
  if (mutationPaths.length === 0) fail('gde3-change-set-empty', 'development change set has no mutation paths');
  if (new Set(mutationPaths).size !== mutationPaths.length) fail('gde3-change-set-conflict', 'development change set contains conflicting paths');
  if (result.expectedPostConditions.length === 0) fail('gde3-post-condition-required', 'expected post-conditions are required');
  return freeze(result);
}

export function createGitHubCanonicalExecutionBridge({ orchestrator, repositoryReadService, developmentPlanner } = {}) {
  if (!orchestrator?.handle) throw new TypeError('orchestrator.handle is required');
  if (!repositoryReadService?.readSnapshot) throw new TypeError('repositoryReadService.readSnapshot is required');
  if (!developmentPlanner?.plan) throw new TypeError('developmentPlanner.plan is required');
  return freeze({
    name: 'gde3-canonical-to-gh3-bridge',
    async execute({ canonicalInput, canonicalModel, resolvedTarget, capabilityAssessment } = {}) {
      if (canonicalModel?.resolutionStatus !== 'resolved' || canonicalModel?.action?.name !== 'github.development.execute') fail('gde3-canonical-action-unsupported', 'resolved github.development.execute action is required');
      if (capabilityAssessment?.available !== true) fail('gde3-capability-unavailable', 'current GitHub capability assessment denied execution');
      const repository = createGitHubRepositoryIdentity(resolvedTarget?.repository);
      const branch = text(resolvedTarget?.branch, 'resolvedTarget.branch', 300);
      const baselineHead = text(resolvedTarget?.baselineHead, 'resolvedTarget.baselineHead', 40).toLowerCase();
      if (!SHA.test(baselineHead)) fail('gde3-baseline-invalid', 'exact baseline HEAD is required');
      const planned = plan(await developmentPlanner.plan(freeze({ canonicalInput, canonicalModel, resolvedTarget })));
      const snapshot = await repositoryReadService.readSnapshot({ repository, ref: { kind: 'branch', name: branch }, visibility: resolvedTarget.visibility ?? 'authorized-private', connectionId: resolvedTarget.connectionId, files: planned.filesToRead });
      if (snapshot?.revision !== baselineHead) fail('gde3-stale-head', 'repository HEAD drifted after target resolution');
      const allowedOperations = capabilityAssessment.capabilities.filter((item) => OPERATIONS.has(item));
      const completion = resolvedTarget.completionCondition ?? { kind: 'exact-head-ci-green', targetWorkflow: 'SG 2.1 CI', maxAttempts: 3, evidenceRequirements: ['tests','exact-head-ci'] };
      const task = {
        taskId: taskId(canonicalInput), repository, targetRef: { kind: 'branch', name: branch }, baseline: { repository, sha: baselineHead },
        intent: text(canonicalModel.parameters?.instruction ?? canonicalInput.text, 'instruction'), allowedOperations,
        allowedPaths: [...new Set([...planned.filesToRead,...planned.filesToCreate,...planned.filesToModify,...planned.filesToDelete,...planned.tests,...planned.docs,...planned.migrations])],
        completionCondition: { maxAttempts: 3, evidenceRequirements: [], ...completion }, developmentPlan: planned, status: 'ready'
      };
      const created = await orchestrator.handle({ canonicalInput, command: { operation: 'create', task } });
      const resumed = await orchestrator.handle({ canonicalInput, command: { operation: 'resume', taskId: created.task.taskId } });
      return freeze({ contractVersion: 1, canonicalAction: canonicalModel.action.name, executionOwner: 'GitHubDevelopmentOrchestrator', task: resumed.task, developmentPlan: planned, created: created.mutated, reused: created.reused, execution: resumed.execution, provenance: { traceId: canonicalInput.traceContext.traceId, requestId: canonicalInput.traceContext.requestId, canonicalResolver: canonicalModel.provenance?.resolver ?? null, targetEvidence: resolvedTarget.evidence ?? null } });
    }
  });
}
