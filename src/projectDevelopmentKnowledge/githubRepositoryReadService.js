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
function jsonLength(value) { return JSON.stringify(value).length; }
function compactEvidenceToBudget(snapshot, maxCharacters) {
  const mutable = JSON.parse(JSON.stringify(snapshot));
  let truncated = false;
  let guard = 0;
  while (jsonLength(mutable) > maxCharacters && guard < 300) {
    guard += 1;
    let changed = false;
    const longestFile = [...(mutable.relevantFiles ?? [])]
      .filter((file) => typeof file.content === 'string' && file.content.length > 500)
      .sort((a, b) => b.content.length - a.content.length)[0];
    if (longestFile) {
      longestFile.content = longestFile.content.slice(0, Math.max(500, Math.floor(longestFile.content.length * 0.7)));
      longestFile.truncated = true;
      changed = true;
    } else {
      const commitWithExtraFiles = [...(mutable.recentCommits ?? [])].reverse().find((commit) => (commit.files?.length ?? 0) > 4);
      if (commitWithExtraFiles) {
        commitWithExtraFiles.files.pop();
        commitWithExtraFiles.filesTruncated = true;
        changed = true;
      } else if ((mutable.tree?.paths?.length ?? 0) > 12) {
        mutable.tree.paths.pop();
        mutable.tree.truncated = true;
        changed = true;
      } else if ((mutable.recentCommits?.length ?? 0) > 3) {
        mutable.recentCommits.pop();
        mutable.recentCommitsTruncated = true;
        changed = true;
      } else if ((mutable.relevantFiles?.length ?? 0) > 2) {
        mutable.relevantFiles.pop();
        mutable.relevantFilesTruncated = true;
        changed = true;
      } else {
        const longMessage = [...(mutable.recentCommits ?? [])].find((commit) => typeof commit.message === 'string' && commit.message.length > 240);
        if (longMessage) {
          longMessage.message = `${longMessage.message.slice(0, 239)}…`;
          changed = true;
        }
      }
    }
    if (!changed) break;
    truncated = true;
  }
  if (jsonLength(mutable) > maxCharacters) fail('pdk4-repository-evidence-too-large', 'Repository evidence cannot satisfy the model-input evidence budget');
  mutable.evidence = { ...(mutable.evidence ?? {}), truncated: Boolean(mutable.evidence?.truncated || truncated), characters: jsonLength(mutable), maxCharacters };
  return Object.freeze(mutable);
}

export const PDK4_GITHUB_REPOSITORY_READ_CONTRACT_VERSION = 2;

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
  maxPatchCharacters = 3000,
  maxChangedFilesPerCommit = 12,
  maxReturnedTreePaths = 24,
  maxEvidenceCharacters = 7000
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
  boundedInteger(maxPatchCharacters, 'maxPatchCharacters', 3000, 200, 10000);
  const changedFileLimit = boundedInteger(maxChangedFilesPerCommit, 'maxChangedFilesPerCommit', 12, 1, 50);
  const returnedTreePathLimit = boundedInteger(maxReturnedTreePaths, 'maxReturnedTreePaths', 24, 4, 200);
  const evidenceCharacterLimit = boundedInteger(maxEvidenceCharacters, 'maxEvidenceCharacters', 7000, 3000, 20000);
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
      const allChangedFiles = Array.isArray(detail?.files) ? detail.files : [];
      for (const file of allChangedFiles) {
        const path = String(file?.filename ?? '');
        if (path) changedPaths.add(path);
      }
      const changedFiles = allChangedFiles.slice(0, changedFileLimit).map((file) => Object.freeze({
        path: String(file?.filename ?? ''),
        status: file?.status ?? null,
        additions: Number(file?.additions ?? 0),
        deletions: Number(file?.deletions ?? 0)
      })).filter((file) => file.path);
      commitDetails.push(Object.freeze({
        sha,
        committedAt: detail?.commit?.committer?.date ?? detail?.commit?.author?.date ?? null,
        author: detail?.commit?.author?.name ?? detail?.author?.login ?? null,
        message: boundedText(detail?.commit?.message ?? '', 600).text,
        files: Object.freeze(changedFiles),
        filesTruncated: allChangedFiles.length > changedFiles.length
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
    const returnedTreePaths = [...new Set([...selectedPaths, ...[...changedPaths], ...ranked])].slice(0, returnedTreePathLimit);
    const rawEvidence = {
      contractVersion: PDK4_GITHUB_REPOSITORY_READ_CONTRACT_VERSION,
      repository: repo,
      branch,
      head: { sha: headSha, committedAt: head?.commit?.committer?.date ?? head?.commit?.author?.date ?? null, message: boundedText(head?.commit?.message ?? '', 600).text },
      recentCommits: commitDetails,
      recentCommitsTruncated: recentRows.length > commitDetails.length,
      relevantFiles,
      relevantFilesTruncated: selectedPaths.length > relevantFiles.length,
      tree: { totalBlobCount: fullTree.length, paths: returnedTreePaths, truncated: treeTruncatedByGitHub || fullTree.length > treeLimit || treePaths.length > returnedTreePaths.length },
      mutated: false,
      sources: [`github:${repo}@${headSha}`],
      evidence: { bounded: true, truncated: false, characters: 0, maxCharacters: evidenceCharacterLimit }
    };
    return compactEvidenceToBudget(rawEvidence, evidenceCharacterLimit);
  }

  return Object.freeze({ snapshot });
}
