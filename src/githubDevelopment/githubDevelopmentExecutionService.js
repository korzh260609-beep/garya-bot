import { parseStructuredAIOutput } from '../ai/contracts.js';
import { createGitHubMutationPlan } from './githubDevelopmentContract.js';

const MAX_TREE_PATHS = 500;
const MAX_SELECTED_FILES = 12;
const MAX_CHANGE_FILES = 12;
const MAX_FILE_CONTENT = 120000;
const MAX_TOTAL_CONTENT = 360000;

const FILE_SELECTION_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['files', 'rationale'],
  properties: {
    files: { type: 'array', maxItems: MAX_SELECTED_FILES, items: { type: 'string', minLength: 1 } },
    rationale: { type: 'string' }
  }
});

const CHANGE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['operation', 'path', 'content'],
  properties: {
    operation: { type: 'string', enum: ['create', 'update'] },
    path: { type: 'string', minLength: 1 },
    content: { type: 'string' }
  }
});

const DEVELOPMENT_PLAN_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'commitMessage', 'changes'],
  properties: {
    summary: { type: 'string', minLength: 1 },
    commitMessage: { type: 'string', minLength: 1 },
    changes: { type: 'array', minItems: 1, maxItems: MAX_CHANGE_FILES, items: CHANGE_SCHEMA }
  }
});

function fail(code, message, retryable = false) {
  const error = new Error(message);
  error.name = 'GitHubDevelopmentExecutionError';
  error.code = code;
  error.retryable = retryable;
  throw error;
}

function required(value, field, max = 50000) {
  if (typeof value !== 'string' || value.trim() === '') fail('gh3-execution-input-invalid', `${field} is required`);
  const text = value.trim();
  if (text.length > max) fail('gh3-execution-input-too-large', `${field} is too large`);
  return text;
}

function safePath(value) {
  const path = required(value, 'path', 500).replace(/\\/gu, '/');
  if (path.startsWith('/') || path.split('/').includes('..')) fail('gh3-execution-path-denied', `unsafe repository path: ${path}`);
  if (/^(?:\.env(?:\.|$)|\.git\/|secrets?\/|credentials?\/)/iu.test(path)) fail('gh3-execution-path-denied', `sensitive repository path is not writable: ${path}`);
  return path;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function repositoryParts(fullName) {
  const value = required(fullName, 'repository', 300);
  const parts = value.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) fail('gh3-execution-repository-invalid', 'repository must use owner/name form');
  return Object.freeze({ owner: parts[0], name: parts[1] });
}

function selectedFilesFrom(result, availablePaths) {
  const parsed = parseStructuredAIOutput(result);
  const files = Array.isArray(parsed.files) ? parsed.files : [];
  const available = new Set(availablePaths);
  return Object.freeze([...new Set(files.map(safePath).filter((path) => available.has(path)))].slice(0, MAX_SELECTED_FILES));
}

function normalizedPlan(result, snapshot) {
  const parsed = parseStructuredAIOutput(result);
  const rawChanges = Array.isArray(parsed.changes) ? parsed.changes : [];
  if (rawChanges.length < 1 || rawChanges.length > MAX_CHANGE_FILES) fail('gh3-execution-plan-invalid', 'development plan must contain a bounded set of changes');
  const tree = new Map((snapshot.tree?.entries ?? []).filter((item) => item?.type === 'blob' && item.path).map((item) => [item.path, item]));
  const loaded = new Set((snapshot.files ?? []).map((item) => item.path));
  const seen = new Set();
  let total = 0;
  const changes = rawChanges.map((item) => {
    const operation = item?.operation;
    if (!['create', 'update'].includes(operation)) fail('gh3-execution-plan-invalid', 'only create/update operations are allowed by the bounded production executor');
    const path = safePath(item?.path);
    if (seen.has(path)) fail('gh3-execution-plan-invalid', `duplicate path in plan: ${path}`);
    seen.add(path);
    const content = typeof item?.content === 'string' ? item.content : fail('gh3-execution-plan-invalid', `content is required for ${path}`);
    if (content.length > MAX_FILE_CONTENT) fail('gh3-execution-plan-too-large', `generated content is too large: ${path}`);
    total += content.length;
    if (total > MAX_TOTAL_CONTENT) fail('gh3-execution-plan-too-large', 'generated change set is too large');
    const current = tree.get(path) ?? null;
    if (operation === 'create' && current) fail('gh3-execution-plan-conflict', `AI attempted to create an existing path: ${path}`);
    if (operation === 'update' && !current) fail('gh3-execution-plan-conflict', `AI attempted to update a missing path: ${path}`);
    if (operation === 'update' && !loaded.has(path)) fail('gh3-execution-plan-unobserved', `AI attempted to update a file that was not read: ${path}`);
    return Object.freeze({
      operation,
      path,
      expectedBlobSha: operation === 'update' ? current.sha : null,
      content
    });
  });
  return freeze({
    summary: required(parsed.summary, 'summary', 2000),
    commitMessage: required(parsed.commitMessage, 'commitMessage', 240),
    changes
  });
}

export function createGitHubDevelopmentExecutionService({
  aiRouter,
  repositoryReadService,
  atomicCommitService,
  repository,
  branch,
  connectionId = 'github-development',
  clock = () => new Date()
} = {}) {
  if (!aiRouter?.route) throw new TypeError('aiRouter.route is required');
  if (!repositoryReadService?.readSnapshot) throw new TypeError('repositoryReadService.readSnapshot is required');
  if (!atomicCommitService?.applyAtomicCommit) throw new TypeError('atomicCommitService.applyAtomicCommit is required');
  if (typeof clock !== 'function') throw new TypeError('clock is required');
  const repo = repositoryParts(repository);
  const targetBranch = required(branch, 'branch', 300);
  const connection = required(connectionId, 'connectionId', 200);

  async function execute({ instruction, actor, traceContext } = {}) {
    const text = required(instruction, 'instruction', 50000);
    if (!actor?.globalUserId) fail('gh3-execution-identity-required', 'verified actor is required');
    if (!traceContext?.traceId || !traceContext?.requestId) fail('gh3-execution-trace-required', 'trace context is required');

    const discovery = await repositoryReadService.readSnapshot({
      repository: repo,
      ref: { kind: 'branch', name: targetBranch },
      visibility: 'authorized-private',
      connectionId: connection,
      files: []
    });
    const treePaths = (discovery.tree?.entries ?? [])
      .filter((item) => item?.type === 'blob' && typeof item.path === 'string')
      .map((item) => item.path)
      .slice(0, MAX_TREE_PATHS);

    const selection = await aiRouter.route({
      task: 'github-development-file-selection',
      specialty: 'coding',
      reason: 'Select bounded repository files needed for an instructed GitHub development task',
      traceContext,
      identityContext: actor,
      role: actor.roles?.[0] ?? 'guest',
      messages: [
        { role: 'system', content: 'You are SG GitHub Development Workspace. Select only existing repository files that must be read before implementing the user instruction. Do not execute or claim completion. Return schema-valid JSON only. Prefer the smallest sufficient set. Never select secret material or .env files.' },
        { role: 'user', content: JSON.stringify({ instruction: text, repository: `${repo.owner}/${repo.name}`, branch: targetBranch, exactHead: discovery.revision, paths: treePaths }) }
      ],
      responseFormat: { name: 'github_development_file_selection', jsonSchema: FILE_SELECTION_SCHEMA, strict: false },
      maxOutputTokens: 1500,
      metadata: { repository: `${repo.owner}/${repo.name}`, branch: targetBranch, operation: 'file-selection' }
    });
    const selectedFiles = selectedFilesFrom(selection, treePaths);

    const snapshot = await repositoryReadService.readSnapshot({
      repository: repo,
      ref: { kind: 'branch', name: targetBranch },
      visibility: 'authorized-private',
      connectionId: connection,
      files: selectedFiles
    });

    const evidence = {
      instruction: text,
      repository: `${repo.owner}/${repo.name}`,
      branch: targetBranch,
      exactHead: snapshot.revision,
      files: (snapshot.files ?? []).map((file) => ({ path: file.path, sha: file.sha, content: file.content, truncated: file.truncated === true })),
      canonicalDocuments: (snapshot.files ?? []).filter((file) => /(?:README|ROADMAP|STATUS|LIFECYCLE_ACTIVITY)/iu.test(file.path ?? '')).map((file) => file.path)
    };
    if (evidence.files.some((file) => file.truncated)) fail('gh3-execution-evidence-truncated', 'required repository file evidence is truncated; refusing to mutate');

    const planned = await aiRouter.route({
      task: 'github-development-change-plan',
      specialty: 'coding',
      reason: 'Generate a bounded exact-head repository change for an instructed GitHub development task',
      traceContext,
      identityContext: actor,
      role: actor.roles?.[0] ?? 'guest',
      messages: [
        { role: 'system', content: 'You are the bounded code-editing component of SG GitHub Development Workspace. Use only supplied repository evidence. Implement the user instruction without changing unrelated logic. Return schema-valid JSON only. Only create or update files. For update, return the COMPLETE replacement UTF-8 file content, not a diff. Do not touch secrets, credentials, .env files, protected-branch settings or repository administration. Do not claim tests, CI, deployment or live verification unless those facts were supplied as evidence.' },
        { role: 'user', content: JSON.stringify(evidence) }
      ],
      responseFormat: { name: 'github_development_change_plan', jsonSchema: DEVELOPMENT_PLAN_SCHEMA, strict: false },
      maxOutputTokens: 12000,
      metadata: { repository: `${repo.owner}/${repo.name}`, branch: targetBranch, exactHead: snapshot.revision, operation: 'change-plan' }
    });
    const plan = normalizedPlan(planned, snapshot);
    const fileContents = Object.fromEntries(plan.changes.filter((item) => item.operation !== 'delete').map((item) => [item.path, item.content]));
    const mutationPlan = createGitHubMutationPlan({
      repository: repo,
      targetRef: { kind: 'branch', name: targetBranch },
      baseline: { repository: repo, sha: snapshot.revision },
      changes: plan.changes.map(({ content: _content, ...change }) => change),
      commitMessage: plan.commitMessage,
      idempotencyKey: `gh3:${traceContext.requestId}`
    });
    const mutation = await atomicCommitService.applyAtomicCommit({ connectionId: connection, mutationPlan, fileContents });
    return freeze({
      status: 'success',
      repository: `${repo.owner}/${repo.name}`,
      branch: targetBranch,
      baselineSha: snapshot.revision,
      commitSha: mutation.commitSha,
      changedPaths: mutation.changedPaths,
      summary: plan.summary,
      mutated: mutation.mutated === true,
      reused: mutation.reused === true,
      observedAt: clock().toISOString()
    });
  }

  return Object.freeze({ execute, repository: `${repo.owner}/${repo.name}`, branch: targetBranch, connectionId: connection });
}
