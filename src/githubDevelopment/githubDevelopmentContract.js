const SHA_PATTERN = /^[0-9a-f]{40}$/;
const REPOSITORY_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
const REF_PATTERN = /^(refs\/(heads|tags)\/)?[A-Za-z0-9][A-Za-z0-9._\/-]*$/;

function invariant(condition, message, code = 'gh3-contract-invalid') {
  if (condition) return;
  const error = new TypeError(message);
  error.code = code;
  throw error;
}

function object(value, field) {
  invariant(value && typeof value === 'object' && !Array.isArray(value), `${field} must be an object`);
  return value;
}

function string(value, field) {
  invariant(typeof value === 'string' && value.trim() !== '', `${field} must be a non-empty string`);
  return value.trim();
}

function optionalString(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return string(value, field);
}

function stringList(value, field) {
  invariant(Array.isArray(value), `${field} must be an array`);
  const normalized = value.map((entry) => string(entry, field));
  invariant(new Set(normalized).size === normalized.length, `${field} must not contain duplicates`);
  return normalized;
}

function integer(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  invariant(Number.isInteger(value) && value >= min && value <= max, `${field} must be an integer from ${min} to ${max}`);
  return value;
}

function timestamp(value, field) {
  const raw = string(value, field);
  invariant(!Number.isNaN(Date.parse(raw)), `${field} must be an ISO-compatible timestamp`);
  return new Date(raw).toISOString();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

export const GITHUB_REF_KINDS = Object.freeze(['branch', 'tag', 'pull-request', 'commit']);
export const GITHUB_CHANGE_OPERATIONS = Object.freeze(['create', 'update', 'move', 'delete']);
export const GITHUB_CI_CONCLUSIONS = Object.freeze(['success', 'failure', 'cancelled', 'skipped', 'timed_out', 'action_required', 'neutral', 'stale', 'unknown']);
export const GITHUB_DEVELOPMENT_TASK_STATUSES = Object.freeze(['planned', 'ready', 'running', 'waiting_ci', 'blocked', 'completed', 'cancelled']);
export const GITHUB_COMPLETION_CONDITION_KINDS = Object.freeze(['exact-head-ci-green', 'pull-request-ready', 'review-feedback-addressed', 'explicit-evidence']);

export function createGitHubRepositoryIdentity(input) {
  object(input, 'repository');
  const owner = string(input.owner, 'repository.owner');
  const name = string(input.name, 'repository.name');
  invariant(REPOSITORY_NAME_PATTERN.test(owner), 'repository.owner is invalid');
  invariant(REPOSITORY_NAME_PATTERN.test(name), 'repository.name is invalid');
  const repositoryId = optionalString(input.repositoryId, 'repository.repositoryId');
  return deepFreeze({ provider: 'github', owner, name, fullName: `${owner}/${name}`, repositoryId });
}

export function createGitHubRef(input) {
  object(input, 'ref');
  const kind = string(input.kind, 'ref.kind');
  invariant(GITHUB_REF_KINDS.includes(kind), `unsupported ref.kind: ${kind}`);
  const name = string(input.name, 'ref.name');
  invariant(kind === 'commit' ? SHA_PATTERN.test(name) : REF_PATTERN.test(name), 'ref.name is invalid');
  return deepFreeze({ kind, name });
}

export function createGitHubRevision(input) {
  object(input, 'revision');
  const sha = string(input.sha, 'revision.sha').toLowerCase();
  invariant(SHA_PATTERN.test(sha), 'revision.sha must be a full 40-character commit SHA');
  return deepFreeze({ repository: createGitHubRepositoryIdentity(input.repository), sha });
}

export function createGitHubCompletionCondition(input) {
  object(input, 'completionCondition');
  const kind = string(input.kind, 'completionCondition.kind');
  invariant(GITHUB_COMPLETION_CONDITION_KINDS.includes(kind), `unsupported completionCondition.kind: ${kind}`);
  const maxAttempts = integer(input.maxAttempts, 'completionCondition.maxAttempts', { min: 1, max: 20 });
  const targetWorkflow = optionalString(input.targetWorkflow, 'completionCondition.targetWorkflow');
  if (kind === 'exact-head-ci-green') invariant(targetWorkflow, 'targetWorkflow is required for exact-head-ci-green');
  return deepFreeze({ kind, maxAttempts, targetWorkflow, evidenceRequirements: stringList(input.evidenceRequirements ?? [], 'completionCondition.evidenceRequirements') });
}

export function createGitHubProposedChange(input) {
  object(input, 'proposedChange');
  const operation = string(input.operation, 'proposedChange.operation');
  invariant(GITHUB_CHANGE_OPERATIONS.includes(operation), `unsupported proposedChange.operation: ${operation}`);
  const path = string(input.path, 'proposedChange.path');
  invariant(!path.startsWith('/') && !path.includes('..'), 'proposedChange.path must be repository-relative and traversal-safe');
  const destinationPath = optionalString(input.destinationPath, 'proposedChange.destinationPath');
  invariant(operation === 'move' ? destinationPath : destinationPath === null, 'destinationPath is required only for move');
  if (destinationPath) invariant(!destinationPath.startsWith('/') && !destinationPath.includes('..'), 'destinationPath must be repository-relative and traversal-safe');
  const expectedBlobSha = optionalString(input.expectedBlobSha, 'proposedChange.expectedBlobSha');
  if (expectedBlobSha) invariant(SHA_PATTERN.test(expectedBlobSha), 'expectedBlobSha must be a full SHA');
  return deepFreeze({ operation, path, destinationPath, expectedBlobSha });
}

export function createGitHubMutationPlan(input) {
  object(input, 'mutationPlan');
  const changes = (input.changes ?? []).map(createGitHubProposedChange);
  invariant(changes.length > 0 && changes.length <= 100, 'mutationPlan.changes must contain 1 to 100 changes');
  const paths = changes.flatMap((change) => [change.path, change.destinationPath].filter(Boolean));
  invariant(new Set(paths).size === paths.length, 'mutationPlan paths must be unique');
  return deepFreeze({
    repository: createGitHubRepositoryIdentity(input.repository),
    targetRef: createGitHubRef(input.targetRef),
    baseline: createGitHubRevision(input.baseline),
    changes,
    commitMessage: string(input.commitMessage, 'mutationPlan.commitMessage'),
    idempotencyKey: string(input.idempotencyKey, 'mutationPlan.idempotencyKey')
  });
}

export function createGitHubCIRun(input) {
  object(input, 'ciRun');
  const conclusion = input.conclusion ?? 'unknown';
  invariant(GITHUB_CI_CONCLUSIONS.includes(conclusion), `unsupported ciRun.conclusion: ${conclusion}`);
  return deepFreeze({
    repository: createGitHubRepositoryIdentity(input.repository),
    revision: createGitHubRevision(input.revision),
    runId: string(input.runId, 'ciRun.runId'),
    workflow: string(input.workflow, 'ciRun.workflow'),
    status: string(input.status, 'ciRun.status'),
    conclusion,
    observedAt: timestamp(input.observedAt, 'ciRun.observedAt')
  });
}

export function createGitHubDevelopmentTask(input) {
  object(input, 'developmentTask');
  const status = input.status ?? 'planned';
  invariant(GITHUB_DEVELOPMENT_TASK_STATUSES.includes(status), `unsupported developmentTask.status: ${status}`);
  const repository = createGitHubRepositoryIdentity(input.repository);
  const baseline = createGitHubRevision(input.baseline);
  invariant(baseline.repository.fullName === repository.fullName, 'baseline repository must match task repository');
  return deepFreeze({
    taskId: string(input.taskId, 'developmentTask.taskId'),
    globalUserId: string(input.globalUserId, 'developmentTask.globalUserId'),
    projectId: string(input.projectId, 'developmentTask.projectId'),
    repository,
    targetRef: createGitHubRef(input.targetRef),
    baseline,
    intent: string(input.intent, 'developmentTask.intent'),
    allowedOperations: stringList(input.allowedOperations, 'developmentTask.allowedOperations'),
    allowedPaths: stringList(input.allowedPaths, 'developmentTask.allowedPaths'),
    completionCondition: createGitHubCompletionCondition(input.completionCondition),
    status
  });
}

export function assertSameGitHubRepository(left, right) {
  const a = createGitHubRepositoryIdentity(left);
  const b = createGitHubRepositoryIdentity(right);
  invariant(a.fullName === b.fullName, 'cross-repository operation denied', 'gh3-cross-repository-denied');
  if (a.repositoryId && b.repositoryId) invariant(a.repositoryId === b.repositoryId, 'repository identity mismatch', 'gh3-cross-repository-denied');
  return true;
}
