export const PDK4_GITHUB_VERIFIER_CONTRACT_VERSION = 1;

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function normalizeRepository(value) {
  const repository = requiredString(value, 'repository').toLowerCase();
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repository)) throw new TypeError('repository must be owner/name');
  return repository;
}
function normalizeSha(value, name = 'sha') {
  const sha = requiredString(value, name).toLowerCase();
  if (!/^[a-f0-9]{7,64}$/.test(sha)) throw new TypeError(`${name} must be a hexadecimal git revision`);
  return sha;
}
function fail(code, message, status = null) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  throw error;
}
function assertAllowed(repository, allowedRepositories) {
  if (!allowedRepositories.has(repository)) fail('pdk4-source-repository-denied', `repository is not approved for PDK4: ${repository}`);
}
function encodePath(path) {
  return requiredString(path, 'path').split('/').map(encodeURIComponent).join('/');
}
function decodeBase64(content) {
  return Buffer.from(String(content ?? '').replace(/\n/g, ''), 'base64').toString('utf8');
}

export function createGitHubDevelopmentSourceVerifier({
  fetchImpl = globalThis.fetch,
  allowedRepositories = [],
  apiBaseUrl = 'https://api.github.com',
  headersProvider = async () => ({})
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');
  if (typeof headersProvider !== 'function') throw new TypeError('headersProvider must be a function');
  const allowed = new Set(allowedRepositories.map(normalizeRepository));
  if (allowed.size === 0) fail('pdk4-source-policy-missing', 'at least one approved GitHub repository is required');
  const base = requiredString(apiBaseUrl, 'apiBaseUrl').replace(/\/+$/, '');

  async function request(path) {
    let extraHeaders;
    try {
      extraHeaders = await headersProvider();
    } catch {
      fail('pdk4-source-connector-unavailable', 'GitHub request headers are unavailable');
    }
    let response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'sg-pdk4-source-verifier',
          ...(extraHeaders ?? {})
        }
      });
    } catch {
      fail('pdk4-source-connector-unavailable', 'GitHub source verification network request failed');
    }
    if (!response?.ok) fail('pdk4-source-verification-failed', `GitHub source verification failed with status ${response?.status ?? 'unknown'}`, response?.status ?? null);
    try {
      return await response.json();
    } catch {
      fail('pdk4-source-verification-failed', 'GitHub source verification returned invalid JSON');
    }
  }

  async function getCommit({ repository: repositoryInput, sha: shaInput }) {
    const repository = normalizeRepository(repositoryInput);
    assertAllowed(repository, allowed);
    const sha = normalizeSha(shaInput);
    const record = await request(`/repos/${repository}/commits/${sha}`);
    return {
      sha: normalizeSha(record.sha, 'verified commit.sha'),
      committedAt: record.commit?.committer?.date ?? record.commit?.author?.date,
      message: record.commit?.message ?? null,
      parentShas: Array.isArray(record.parents) ? record.parents.map((parent) => parent.sha) : [],
      stats: record.stats ?? null,
      files: Array.isArray(record.files) ? record.files.map((file) => ({
        path: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch ?? null
      })) : []
    };
  }

  async function getPullRequest({ repository: repositoryInput, number: numberInput }) {
    const repository = normalizeRepository(repositoryInput);
    assertAllowed(repository, allowed);
    const number = Number(numberInput);
    if (!Number.isInteger(number) || number < 1) throw new TypeError('number must be a positive integer');
    const record = await request(`/repos/${repository}/pulls/${number}`);
    const files = await request(`/repos/${repository}/pulls/${number}/files?per_page=100`);
    return {
      number: Number(record.number),
      headSha: record.head?.sha,
      baseSha: record.base?.sha,
      state: record.state,
      merged: record.merged === true,
      mergedAt: record.merged_at,
      updatedAt: record.updated_at,
      createdAt: record.created_at,
      title: record.title,
      body: record.body,
      files: Array.isArray(files) ? files.map((file) => ({
        path: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch ?? null
      })) : []
    };
  }

  async function getWorkflowRun({ repository: repositoryInput, runId: runIdInput, attempt: attemptInput = 1 }) {
    const repository = normalizeRepository(repositoryInput);
    assertAllowed(repository, allowed);
    const runId = String(runIdInput ?? '').trim();
    const attempt = Number(attemptInput);
    if (!/^\d+$/.test(runId)) throw new TypeError('runId must be numeric');
    if (!Number.isInteger(attempt) || attempt < 1) throw new TypeError('attempt must be a positive integer');
    const record = await request(`/repos/${repository}/actions/runs/${runId}`);
    if (Number(record.run_attempt ?? 1) !== attempt) fail('pdk4-source-identity-mismatch', 'GitHub workflow attempt does not match requested immutable source');
    const jobsRecord = await request(`/repos/${repository}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`);
    return {
      runId: String(record.id),
      attempt: Number(record.run_attempt ?? 1),
      workflowName: record.name,
      headSha: record.head_sha,
      status: record.status,
      conclusion: record.conclusion,
      event: record.event,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      completedAt: record.updated_at,
      jobs: Array.isArray(jobsRecord?.jobs) ? jobsRecord.jobs.map((job) => ({ name: job.name, status: job.status, conclusion: job.conclusion })) : []
    };
  }

  async function getFileAtRevision({ repository: repositoryInput, path: pathInput, revision: revisionInput }) {
    const repository = normalizeRepository(repositoryInput);
    assertAllowed(repository, allowed);
    const path = requiredString(pathInput, 'path');
    const revision = normalizeSha(revisionInput, 'revision');
    const file = await request(`/repos/${repository}/contents/${encodePath(path)}?ref=${encodeURIComponent(revision)}`);
    if (file?.type !== 'file' || typeof file.content !== 'string' || file.encoding !== 'base64') {
      fail('pdk4-source-verification-failed', 'GitHub canonical document response is not a base64 file');
    }
    const commit = await request(`/repos/${repository}/commits/${revision}`);
    if (normalizeSha(commit.sha, 'verified document commit') !== revision) fail('pdk4-source-identity-mismatch', 'canonical document revision does not match GitHub commit');
    return {
      path: file.path,
      revision,
      committedAt: commit.commit?.committer?.date ?? commit.commit?.author?.date,
      content: decodeBase64(file.content)
    };
  }

  return Object.freeze({ getCommit, getPullRequest, getWorkflowRun, getFileAtRevision });
}
