import { createGitHubMutationPlan, createGitHubRepositoryIdentity } from './githubDevelopmentContract.js';

const SHA = /^[0-9a-f]{40}$/u;

function fail(code, message, { status = null, retryable = false } = {}) { const error = new Error(message); error.name = 'GitHubAtomicCommitError'; error.code = code; error.status = status; error.retryable = retryable; throw error; }
function required(value, field) { if (typeof value !== 'string' || value.trim() === '') fail('gh3-atomic-input-invalid', `${field} is required`); return value.trim(); }
function fullSha(value, field) { const normalized = required(value, field).toLowerCase(); if (!SHA.test(normalized)) fail('gh3-atomic-response-invalid', `${field} must be a full SHA`); return normalized; }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const nested of Object.values(value)) freeze(nested); return Object.freeze(value); }
function branchName(ref) { if (ref.kind !== 'branch') fail('gh3-atomic-branch-required', 'target ref must be a branch'); return ref.name.replace(/^refs\/heads\//u, ''); }
function encodePath(value) { return String(value).split('/').map(encodeURIComponent).join('/'); }
function idempotencyTrailer(key) { return `SG-Idempotency-Key: ${key}`; }

export function createGitHubAtomicCommitService({ fetchImpl = globalThis.fetch, githubAppProvider, apiBaseUrl = 'https://api.github.com', clock = () => new Date() } = {}) {
  if (typeof fetchImpl !== 'function' || typeof clock !== 'function') throw new TypeError('invalid atomic-commit dependency');
  if (!githubAppProvider?.withInstallationToken) throw new TypeError('githubAppProvider.withInstallationToken is required');
  const base = required(apiBaseUrl, 'apiBaseUrl').replace(/\/+$/u, '');

  async function request(path, { token, method = 'GET', body = null, allowNotFound = false } = {}) {
    let response;
    try { response = await fetchImpl(`${base}${path}`, { method, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'sg-gh3-atomic-commit', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
    catch { fail('gh3-atomic-provider-unavailable', 'GitHub atomic operation failed', { retryable: true }); }
    if (allowNotFound && response?.status === 404) return null;
    if (response?.status === 403) fail('gh3-atomic-permission-denied', 'GitHub mutation permission is unavailable', { status: 403 });
    if (response?.status === 409 || response?.status === 422) fail('gh3-atomic-non-fast-forward', 'GitHub rejected a stale or non-fast-forward mutation', { status: response.status });
    if (!response?.ok) fail(`gh3-atomic-http-${response?.status ?? 'unknown'}`, 'GitHub atomic operation was not successful', { status: response?.status ?? null, retryable: response?.status >= 500 });
    try { return await response.json(); } catch { fail('gh3-atomic-response-invalid', 'GitHub atomic operation returned invalid JSON'); }
  }

  function root(repository) { return `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`; }
  async function refHead(repository, branch, token, allowNotFound = false) { const body = await request(`${root(repository)}/git/ref/heads/${encodePath(branch)}`, { token, allowNotFound }); return body ? fullSha(body?.object?.sha, 'ref.object.sha') : null; }

  async function ensureBranch({ connectionId, repository: repositoryInput, branch, baselineSha } = {}) {
    const repository = createGitHubRepositoryIdentity(repositoryInput); const name = required(branch, 'branch'); const baseline = fullSha(baselineSha, 'baselineSha');
    return githubAppProvider.withInstallationToken({ connectionId: required(connectionId, 'connectionId'), capability: 'github.branch.create', repository, requiredProviderPermission: 'contents', operation: async (token) => {
      const existing = await refHead(repository, name, token, true);
      if (existing) {
        if (existing !== baseline) fail('gh3-atomic-stale-head', 'existing branch does not match authorized baseline');
        return freeze({ repository, branch: name, headSha: existing, created: false, reused: true, mutated: false });
      }
      const body = await request(`${root(repository)}/git/refs`, { token, method: 'POST', body: { ref: `refs/heads/${name}`, sha: baseline } });
      const headSha = fullSha(body?.object?.sha, 'createdRef.object.sha');
      if (headSha !== baseline) fail('gh3-atomic-response-invalid', 'created branch does not match authorized baseline');
      return freeze({ repository, branch: name, headSha, created: true, reused: false, mutated: true });
    } });
  }

  async function applyAtomicCommit({ connectionId, mutationPlan: planInput, fileContents = {} } = {}) {
    const plan = createGitHubMutationPlan(planInput); const repository = plan.repository; const branch = branchName(plan.targetRef); const baseline = plan.baseline.sha;
    if (plan.baseline.repository.fullName !== repository.fullName) fail('gh3-cross-repository-denied', 'mutation baseline belongs to another repository');
    return githubAppProvider.withInstallationToken({ connectionId: required(connectionId, 'connectionId'), capability: 'github.commit.create', repository, requiredProviderPermission: 'contents', operation: async (token) => {
      const currentHead = await refHead(repository, branch, token);
      if (currentHead !== baseline) {
        const currentCommit = await request(`${root(repository)}/git/commits/${currentHead}`, { token });
        if (String(currentCommit?.message ?? '').includes(idempotencyTrailer(plan.idempotencyKey))) return freeze({ repository, branch, baselineSha: baseline, commitSha: currentHead, reused: true, mutated: false, changedPaths: plan.changes.flatMap((change) => [change.path, change.destinationPath].filter(Boolean)), rollback: { branch, restoreHeadSha: baseline, forceRequired: true } });
        fail('gh3-atomic-stale-head', 'branch HEAD no longer matches the authorized baseline');
      }
      const commit = await request(`${root(repository)}/git/commits/${baseline}`, { token });
      const baseTreeSha = fullSha(commit?.tree?.sha, 'commit.tree.sha');
      const treeBody = await request(`${root(repository)}/git/trees/${baseTreeSha}?recursive=1`, { token });
      const entries = new Map((treeBody?.tree ?? []).filter((entry) => entry?.type === 'blob' && typeof entry.path === 'string').map((entry) => [entry.path, entry]));
      const tree = [];
      const reverseOperations = [];
      for (const change of plan.changes) {
        const source = entries.get(change.path) ?? null;
        if (change.expectedBlobSha && source?.sha !== change.expectedBlobSha) fail('gh3-atomic-blob-conflict', `blob changed before ${change.operation}: ${change.path}`);
        if (change.operation === 'create' && source) fail('gh3-atomic-path-exists', `path already exists: ${change.path}`);
        if (['update', 'move', 'delete'].includes(change.operation) && !source) fail('gh3-atomic-path-missing', `path does not exist: ${change.path}`);
        if (change.operation === 'move' && entries.has(change.destinationPath)) fail('gh3-atomic-path-exists', `destination already exists: ${change.destinationPath}`);
        if (change.operation === 'delete') {
          tree.push({ path: change.path, mode: '100644', type: 'blob', sha: null }); reverseOperations.push({ operation: 'restore', path: change.path, blobSha: source.sha }); continue;
        }
        if (change.operation === 'move') {
          tree.push({ path: change.path, mode: '100644', type: 'blob', sha: null }, { path: change.destinationPath, mode: source.mode ?? '100644', type: 'blob', sha: source.sha });
          reverseOperations.push({ operation: 'move', path: change.destinationPath, destinationPath: change.path, blobSha: source.sha }); continue;
        }
        const content = fileContents[change.path];
        if (typeof content !== 'string') fail('gh3-atomic-content-required', `file content is required: ${change.path}`);
        const blob = await request(`${root(repository)}/git/blobs`, { token, method: 'POST', body: { content, encoding: 'utf-8' } });
        const blobSha = fullSha(blob?.sha, 'blob.sha'); tree.push({ path: change.path, mode: source?.mode ?? '100644', type: 'blob', sha: blobSha });
        reverseOperations.push(source ? { operation: 'restore', path: change.path, blobSha: source.sha } : { operation: 'delete', path: change.path });
      }
      const nextTree = await request(`${root(repository)}/git/trees`, { token, method: 'POST', body: { base_tree: baseTreeSha, tree } });
      const treeSha = fullSha(nextTree?.sha, 'tree.sha');
      const message = `${plan.commitMessage}\n\n${idempotencyTrailer(plan.idempotencyKey)}`;
      const nextCommit = await request(`${root(repository)}/git/commits`, { token, method: 'POST', body: { message, tree: treeSha, parents: [baseline] } });
      const commitSha = fullSha(nextCommit?.sha, 'commit.sha');
      const updated = await request(`${root(repository)}/git/refs/heads/${encodePath(branch)}`, { token, method: 'PATCH', body: { sha: commitSha, force: false } });
      if (fullSha(updated?.object?.sha, 'updatedRef.object.sha') !== commitSha) fail('gh3-atomic-response-invalid', 'updated ref does not match created commit');
      return freeze({ contractVersion: 1, repository, branch, baselineSha: baseline, baseTreeSha, treeSha, commitSha, reused: false, mutated: true, changedPaths: plan.changes.flatMap((change) => [change.path, change.destinationPath].filter(Boolean)), audit: { operation: 'atomic-multi-file-commit', idempotencyKey: plan.idempotencyKey, observedAt: clock().toISOString(), force: false }, rollback: { branch, restoreHeadSha: baseline, forceRequired: true, reverseOperations } });
    } });
  }
  return Object.freeze({ ensureBranch, applyAtomicCommit });
}
