function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function repository(value) {
  const repo = required(value, 'repository').toLowerCase();
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repo)) throw new TypeError('repository must be owner/name');
  return repo;
}
function boundedInteger(value, name, fallback, min, max) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(`${name} must be between ${min} and ${max}`);
  return number;
}
function fail(code, message, status = null) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  throw error;
}
function encodePath(path) {
  return String(path).split('/').map((part) => encodeURIComponent(part)).join('/');
}
function textualPath(path) {
  return /(?:^|\/)(?:README|CHANGELOG|ROADMAP|STATUS|package|PILLARS?)(?:\.|$)/i.test(path)
    || /\.(?:js|mjs|cjs|ts|tsx|jsx|json|md|txt|yml|yaml|toml|sql)$/i.test(path);
}
function queryTokens(value) {
  const source = String(value ?? '').toLowerCase();
  return [...new Set(source.match(/[\p{L}\p{N}_.-]{3,}/gu) ?? [])].slice(0, 40);
}
function pathScore(path, tokens, changedPaths) {
  const lower = path.toLowerCase();
  let score = changedPaths.has(path) ? 100 : 0;
  if (/^readme(?:\.|$)/i.test(path)) score += 40;
  if (/^package\.json$/i.test(path)) score += 35;
  if (/^(?:docs|pillars|evidence)\//i.test(path)) score += 10;
  for (const token of tokens) if (lower.includes(token)) score += 12;
  return score;
}
function decodeContent(body) {
  if (body?.encoding !== 'base64' || typeof body?.content !== 'string') return null;
  try { return Buffer.from(body.content.replace(/\s+/g, ''), 'base64').toString('utf8'); } catch { return null; }
}
function boundedText(value, maxLength) {
  const text = String(value ?? '');
  return Object.freeze({ text: text.slice(0, maxLength), truncated: text.length > maxLength });
}

export const PDK4_GITHUB_REPOSITORY_READ_CONTRACT_VERSION = 1;

export function createGitHubRepositoryReadService({
  config,
  credentialManager,
  credentialAccessContext,
  fetchImpl = globalThis.fetch,
  apiBaseUrl = 'https://api.github.com',
  maxTreeEntries = 1200,
  maxRecentCommits = 8,
  maxRelevantFiles = 8,
  maxFileCharacters = 8000,
  maxPatchCharacters = 3000
} = {}) {
  if (!config || typeof config !== 'object') throw new TypeError('config is required');
  if (!credentialManager?.useCredential) throw new TypeError('credentialManager.useCredential is required');
  if (!credentialAccessContext?.actor || !credentialAccessContext?.scope) throw new TypeError('credentialAccessContext is required');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');
  const repo = repository(config.repository);
  const branch = required(config.branch, 'branch');
  const credentialId = required(config.credentialId, 'credentialId');
  const requestTimeoutMs = boundedInteger(config.requestTimeoutMs, 'requestTimeoutMs', 15000, 1000, 120000);
  const treeLimit = boundedInteger(maxTreeEntries, 'maxTreeEntries', 1200, 10, 5000);
  const commitLimit = boundedInteger(maxRecentCommits, 'maxRecentCommits', 8, 1, 20);
  const fileLimit = boundedInteger(maxRelevantFiles, 'maxRelevantFiles', 8, 1, 20);
  const fileCharacterLimit = boundedInteger(maxFileCharacters, 'maxFileCharacters', 8000, 500, 30000);
  const patchCharacterLimit = boundedInteger(maxPatchCharacters, 'maxPatchCharacters', 3000, 200, 10000);
  const base = required(apiBaseUrl, 'apiBaseUrl').replace(/\/+$/u, '');

  async function headersProvider() {
    try {
      return await credentialManager.useCredential({
        credentialId,
        actor: credentialAccessContext.actor,
        scope: credentialAccessContext.scope,
        purpose: 'pdk4.github.repository.read',
        connectionId: 'github-pdk4',
        operation: async (token) => Object.freeze({ Authorization: `Bearer ${token}` })
      });
    } catch (error) {
      fail(error?.code ?? 'pdk4-repository-read-credential-unavailable', 'GitHub repository-read credential is unavailable');
    }
  }

  async function request(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    timer.unref?.();
    try {
      const headers = await headersProvider();
      let response;
      try {
        response = await fetchImpl(`${base}${path}`, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'sg-pdk4-repository-read',
            ...(headers ?? {})
          }
        });
      } catch {
        fail('pdk4-repository-read-connector-unavailable', 'GitHub repository-read request failed');
      }
      if (!response?.ok) fail('pdk4-repository-read-request-failed', `GitHub repository-read request failed with status ${response?.status ?? 'unknown'}`, response?.status ?? null);
      try { return await response.json(); }
      catch { fail('pdk4-repository-read-response-invalid', 'GitHub repository-read returned invalid JSON'); }
    } finally {
      clearTimeout(timer);
    }
  }

  async function readFile(path, headSha) {
    const body = await request(`/repos/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(headSha)}`);
    if (body?.type !== 'file') return null;
    const decoded = decodeContent(body);
    if (decoded == null) return null;
    const bounded = boundedText(decoded, fileCharacterLimit);
    return Object.freeze({ path, sha: body.sha ?? null, size: Number(body.size ?? decoded.length), content: bounded.text, truncated: bounded.truncated });
  }

  async function snapshot({ query = null, files = [] } = {}) {
    const head = await request(`/repos/${repo}/commits/${encodeURIComponent(branch)}`);
    const headSha = required(head?.sha, 'head.sha').toLowerCase();
    const treeSha = required(head?.commit?.tree?.sha, 'head.commit.tree.sha').toLowerCase();
    const treeBody = await request(`/repos/${repo}/git/trees/${treeSha}?recursive=1`);
    const fullTree = Array.isArray(treeBody?.tree) ? treeBody.tree.filter((entry) => entry?.type === 'blob' && typeof entry.path === 'string') : [];
    const treeTruncatedByGitHub = treeBody?.truncated === true;
    const recentRows = await request(`/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=${commitLimit}&page=1`);
    if (!Array.isArray(recentRows)) fail('pdk4-repository-read-response-invalid', 'GitHub recent commits response must be an array');

    const commitDetails = [];
    const changedPaths = new Set();
    for (const row of recentRows.slice(0, commitLimit)) {
      const sha = required(row?.sha, 'commit.sha').toLowerCase();
      const detail = await request(`/repos/${repo}/commits/${sha}`);
      const changedFiles = Array.isArray(detail?.files) ? detail.files.map((file) => {
        const path = String(file?.filename ?? '');
        if (path) changedPaths.add(path);
        const patch = boundedText(file?.patch ?? '', patchCharacterLimit);
        return Object.freeze({ path, status: file?.status ?? null, additions: Number(file?.additions ?? 0), deletions: Number(file?.deletions ?? 0), patch: patch.text, patchTruncated: patch.truncated });
      }).filter((file) => file.path) : [];
      commitDetails.push(Object.freeze({
        sha,
        committedAt: detail?.commit?.committer?.date ?? detail?.commit?.author?.date ?? null,
        author: detail?.commit?.author?.name ?? detail?.author?.login ?? null,
        message: detail?.commit?.message ?? null,
        files: Object.freeze(changedFiles)
      }));
    }

    const treePaths = fullTree.map((entry) => entry.path);
    const treePathSet = new Set(treePaths);
    const requestedPaths = [...new Set((Array.isArray(files) ? files : []).map((value) => String(value ?? '').trim()).filter((value) => value && treePathSet.has(value) && textualPath(value)))];
    const tokens = queryTokens(query);
    const ranked = treePaths.filter(textualPath).sort((left, right) => pathScore(right, tokens, changedPaths) - pathScore(left, tokens, changedPaths) || left.localeCompare(right));
    const selectedPaths = [...new Set([...requestedPaths, ...ranked])].slice(0, fileLimit);
    const relevantFiles = [];
    for (const path of selectedPaths) {
      try {
        const file = await readFile(path, headSha);
        if (file) relevantFiles.push(file);
      } catch (error) {
        if (requestedPaths.includes(path)) throw error;
      }
    }

    return Object.freeze({
      contractVersion: PDK4_GITHUB_REPOSITORY_READ_CONTRACT_VERSION,
      repository: repo,
      branch,
      head: Object.freeze({ sha: headSha, committedAt: head?.commit?.committer?.date ?? head?.commit?.author?.date ?? null, message: head?.commit?.message ?? null }),
      recentCommits: Object.freeze(commitDetails),
      relevantFiles: Object.freeze(relevantFiles),
      tree: Object.freeze({ totalBlobCount: fullTree.length, paths: Object.freeze(treePaths.slice(0, treeLimit)), truncated: treeTruncatedByGitHub || fullTree.length > treeLimit }),
      mutated: false,
      sources: Object.freeze([`github:${repo}@${headSha}`])
    });
  }

  return Object.freeze({ snapshot });
}
