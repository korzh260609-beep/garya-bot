import { createGitHubRef, createGitHubRepositoryIdentity } from './githubDevelopmentContract.js';

const SHA = /^[0-9a-f]{40}$/u;
const CANONICAL_DOCUMENT = /(?:^|\/)(?:README|CONTRIBUTING|SECURITY|CHANGELOG|ROADMAP|STATUS|CODE_OF_CONDUCT)(?:\.|$)/iu;

function fail(code, message, { retryable = false, status = null } = {}) {
  const error = new Error(message); error.name = 'GitHubRepositoryReadError'; error.code = code; error.retryable = retryable; error.status = status; throw error;
}
function required(value, field) { if (typeof value !== 'string' || value.trim() === '') fail('gh3-repository-read-input-invalid', `${field} is required`); return value.trim(); }
function bounded(value, field, fallback, min, max) { const number = value ?? fallback; if (!Number.isInteger(number) || number < min || number > max) fail('gh3-repository-read-input-invalid', `${field} must be from ${min} to ${max}`); return number; }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const nested of Object.values(value)) freeze(nested); return Object.freeze(value); }
function encodePath(value) { return String(value).split('/').map(encodeURIComponent).join('/'); }
function text(value, limit) { const source = typeof value === 'string' ? value : ''; return { value: source.slice(0, limit), truncated: source.length > limit }; }
function repositoryFromApi(body) {
  if (typeof body?.full_name !== 'string') fail('gh3-repository-read-response-invalid', 'GitHub repository identity is missing');
  const [owner, name, extra] = body.full_name.split('/');
  if (extra || !owner || !name) fail('gh3-repository-read-response-invalid', 'GitHub repository identity is invalid');
  return createGitHubRepositoryIdentity({ owner, name, repositoryId: body.id == null ? null : String(body.id) });
}
function assertRepository(expected, actual) {
  if (expected.fullName.toLowerCase() !== actual.fullName.toLowerCase() || (expected.repositoryId && actual.repositoryId && expected.repositoryId !== actual.repositoryId)) {
    fail('gh3-cross-repository-denied', 'GitHub response belongs to another repository');
  }
}
function sha(value, field) { const normalized = required(value, field).toLowerCase(); if (!SHA.test(normalized)) fail('gh3-repository-read-response-invalid', `${field} must be a full commit SHA`); return normalized; }
function list(value, limit, map) { const source = Array.isArray(value) ? value : []; return { items: source.slice(0, limit).map(map), truncated: source.length > limit } }
function decodeFile(body, maxCharacters) {
  if (body?.type !== 'file' || body.encoding !== 'base64' || typeof body.content !== 'string') return null;
  let decoded; try { decoded = Buffer.from(body.content.replace(/\s+/gu, ''), 'base64').toString('utf8'); } catch { fail('gh3-repository-read-response-invalid', 'GitHub file content is invalid'); }
  const boundedText = text(decoded, maxCharacters);
  return freeze({ path: body.path ?? null, sha: body.sha ?? null, size: Number(body.size ?? decoded.length), content: boundedText.value, truncated: boundedText.truncated });
}

export const GH3_REPOSITORY_READ_CONTRACT_VERSION = 1;

export function createGitHubRepositoryReadAnalysisService({
  fetchImpl = globalThis.fetch,
  githubAppProvider = null,
  apiBaseUrl = 'https://api.github.com',
  clock = () => new Date(),
  maxTreeEntries = 500,
  maxListItems = 50,
  maxFiles = 12,
  maxFileCharacters = 12000
} = {}) {
  if (typeof fetchImpl !== 'function' || typeof clock !== 'function') throw new TypeError('invalid repository-read dependency');
  const base = required(apiBaseUrl, 'apiBaseUrl').replace(/\/+$/u, '');
  const treeLimit = bounded(maxTreeEntries, 'maxTreeEntries', 500, 1, 5000);
  const itemLimit = bounded(maxListItems, 'maxListItems', 50, 1, 100);
  const fileLimit = bounded(maxFiles, 'maxFiles', 12, 1, 30);
  const characterLimit = bounded(maxFileCharacters, 'maxFileCharacters', 12000, 100, 50000);

  async function request(path, token, { allowNotFound = false } = {}) {
    let response;
    try { response = await fetchImpl(`${base}${path}`, { method: 'GET', headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'sg-gh3-repository-read', ...(token ? { Authorization: `Bearer ${token}` } : {}) } }); }
    catch { fail('gh3-repository-read-provider-unavailable', 'GitHub repository read failed', { retryable: true }); }
    if (response?.status === 403) fail('gh3-repository-read-permission-denied', 'GitHub repository read permission is unavailable', { status: 403 });
    if (response?.status === 404 && allowNotFound) return null;
    if (response?.status === 404) fail('gh3-repository-read-not-found', 'GitHub repository resource or ref was not found', { status: 404 });
    if (!response?.ok) fail(`gh3-repository-read-http-${response?.status ?? 'unknown'}`, 'GitHub repository read was not successful', { status: response?.status ?? null, retryable: response?.status >= 500 });
    try { return await response.json(); } catch { fail('gh3-repository-read-response-invalid', 'GitHub repository read returned invalid JSON'); }
  }

  async function resolveRevision(root, ref, token) {
    if (ref.kind === 'commit') {
      const body = await request(`${root}/commits/${encodeURIComponent(ref.name)}`, token);
      return sha(body?.sha, 'commit.sha');
    }
    if (ref.kind === 'branch' || ref.kind === 'tag') {
      const body = await request(`${root}/commits?sha=${encodeURIComponent(ref.name)}&per_page=1`, token);
      if (!Array.isArray(body) || body.length === 0) fail('gh3-repository-read-not-found', 'GitHub repository ref was not found', { status: 404 });
      return sha(body[0]?.sha, 'commit.sha');
    }
    const body = await request(`${root}/commits/${encodePath(ref.name)}`, token);
    return sha(body?.sha, 'commit.sha');
  }

  async function execute(input, repository, ref, token) {
    const root = `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`;
    const metadataBody = await request(root, token);
    const observedRepository = repositoryFromApi(metadataBody); assertRepository(repository, observedRepository);
    const revision = await resolveRevision(root, ref, token);
    if (ref.kind === 'commit' && revision !== ref.name.toLowerCase()) fail('gh3-revision-mismatch', 'GitHub returned a different immutable revision');

    const treeBody = await request(`${root}/git/trees/${revision}?recursive=1`, token);
    const tree = list(treeBody?.tree, treeLimit, (entry) => freeze({ path: entry?.path ?? null, type: entry?.type ?? null, sha: entry?.sha ?? null, size: Number.isFinite(entry?.size) ? entry.size : null }));
    const requestedFiles = [...new Set([...(input.files ?? []), ...tree.items.filter((entry) => CANONICAL_DOCUMENT.test(entry.path ?? '')).map((entry) => entry.path)])]
      .filter((path) => typeof path === 'string' && path && !path.startsWith('/') && !path.split('/').includes('..')).slice(0, fileLimit);
    const files = [];
    const missingFiles = [];
    for (const path of requestedFiles) {
      const body = await request(`${root}/contents/${encodePath(path)}?ref=${revision}`, token, { allowNotFound: true });
      if (!body) { missingFiles.push(path); continue; }
      const decoded = decodeFile(body, characterLimit); if (decoded) files.push(decoded);
    }

    const [commitsBody, issuesBody, pullsBody, checksBody, runsBody] = await Promise.all([
      request(`${root}/commits?sha=${revision}&per_page=${itemLimit}`, token),
      request(`${root}/issues?state=all&per_page=${itemLimit}`, token),
      request(`${root}/pulls?state=all&per_page=${itemLimit}`, token),
      request(`${root}/commits/${revision}/check-runs?per_page=${itemLimit}`, token),
      request(`${root}/actions/runs?head_sha=${revision}&per_page=${itemLimit}`, token)
    ]);
    const compact = (row) => freeze({ id: row?.id == null ? null : String(row.id), number: row?.number ?? null, title: text(row?.title ?? row?.name ?? row?.commit?.message, 500).value, state: row?.state ?? row?.status ?? null, conclusion: row?.conclusion ?? null, sha: row?.sha ?? row?.head_sha ?? null, url: row?.html_url ?? null, updatedAt: row?.updated_at ?? row?.commit?.committer?.date ?? null, untrustedExternalData: true });
    const commits = list(commitsBody, itemLimit, compact);
    const issues = list(issuesBody, itemLimit, compact);
    const pullRequests = list(pullsBody, itemLimit, compact);
    const checks = list(checksBody?.check_runs, itemLimit, compact);
    const workflowRuns = list(runsBody?.workflow_runs, itemLimit, compact);

    let comparison = null;
    if (input.compareWith) {
      const baseRevision = sha(input.compareWith, 'compareWith');
      const body = await request(`${root}/compare/${baseRevision}...${revision}`, token);
      const changed = list(body?.files, itemLimit, (row) => freeze({ path: row?.filename ?? null, status: row?.status ?? null, additions: row?.additions ?? 0, deletions: row?.deletions ?? 0, patch: text(row?.patch, 3000).value, untrustedExternalData: true }));
      comparison = freeze({ baseRevision, headRevision: revision, status: body?.status ?? null, aheadBy: body?.ahead_by ?? null, behindBy: body?.behind_by ?? null, files: changed.items, truncated: changed.truncated });
    }

    const reviews = [], jobs = [], artifacts = [];
    for (const number of (input.pullRequestNumbers ?? []).slice(0, 10)) {
      if (reviews.length >= itemLimit) break;
      reviews.push(...(await request(`${root}/pulls/${bounded(number, 'pullRequestNumber', null, 1, Number.MAX_SAFE_INTEGER)}/reviews?per_page=${itemLimit}`, token)).slice(0, itemLimit - reviews.length).map(compact));
    }
    for (const runId of (input.workflowRunIds ?? []).slice(0, 10)) {
      if (jobs.length >= itemLimit && artifacts.length >= itemLimit) break;
      const id = bounded(runId, 'workflowRunId', null, 1, Number.MAX_SAFE_INTEGER);
      const jobBody = await request(`${root}/actions/runs/${id}/jobs?per_page=${itemLimit}`, token);
      const artifactBody = await request(`${root}/actions/runs/${id}/artifacts?per_page=${itemLimit}`, token);
      jobs.push(...(jobBody?.jobs ?? []).slice(0, itemLimit - jobs.length).map(compact)); artifacts.push(...(artifactBody?.artifacts ?? []).slice(0, itemLimit - artifacts.length).map(compact));
    }
    return freeze({
      contractVersion: GH3_REPOSITORY_READ_CONTRACT_VERSION,
      repository: observedRepository,
      requestedRef: ref,
      revision,
      observedAt: clock().toISOString(),
      metadata: { id: observedRepository.repositoryId, fullName: observedRepository.fullName, defaultBranch: metadataBody.default_branch ?? null, visibility: metadataBody.visibility ?? (metadataBody.private ? 'private' : 'public'), archived: metadataBody.archived === true },
      tree: { entries: tree.items, truncated: tree.truncated || treeBody?.truncated === true }, files, missingFiles,
      history: { commits: commits.items, truncated: commits.truncated },
      collaboration: { issues: issues.items, pullRequests: pullRequests.items, reviews, truncated: issues.truncated || pullRequests.truncated || reviews.length >= itemLimit },
      ci: { checks: checks.items, workflowRuns: workflowRuns.items, jobs, artifacts, truncated: checks.truncated || workflowRuns.truncated || jobs.length >= itemLimit || artifacts.length >= itemLimit },
      comparison,
      provenance: { provider: 'github', source: `github:${observedRepository.fullName}@${revision}`, immutableRevisionVerified: true, connectionId: input.visibility === 'authorized-private' ? input.connectionId : null },
      qualification: { readOnly: true, projectTruth: false, untrustedExternalData: true }
    });
  }

  async function readSnapshot(input = {}) {
    const repository = createGitHubRepositoryIdentity(input.repository);
    const ref = createGitHubRef(input.ref);
    const visibility = input.visibility ?? 'public';
    if (!['public', 'authorized-private'].includes(visibility)) fail('gh3-repository-read-input-invalid', 'visibility is invalid');
    const normalized = { ...input, visibility };
    if (visibility === 'public') return execute(normalized, repository, ref, null);
    if (!githubAppProvider?.withInstallationToken) fail('gh3-repository-read-connection-required', 'authorized private repository read requires GitHub App connection');
    return githubAppProvider.withInstallationToken({ connectionId: required(input.connectionId, 'connectionId'), capability: 'github.repository.read', repository, requiredProviderPermission: 'contents', operation: (token) => execute(normalized, repository, ref, token) });
  }
  return Object.freeze({ readSnapshot });
}
