import { createGitHubRepositoryIdentity } from './githubDevelopmentContract.js';

const SHA = /^[0-9a-f]{40}$/u;
function fail(code, message, { status = null, retryable = false } = {}) { const error = new Error(message); error.name = 'GitHubCollaborationError'; error.code = code; error.status = status; error.retryable = retryable; throw error; }
function required(value, field) { if (typeof value !== 'string' || value.trim() === '') fail('gh3-collaboration-input-invalid', `${field} is required`); return value.trim(); }
function integer(value, field) { if (!Number.isInteger(value) || value < 1) fail('gh3-collaboration-input-invalid', `${field} must be a positive integer`); return value; }
function fullSha(value, field) { const normalized = required(value, field).toLowerCase(); if (!SHA.test(normalized)) fail('gh3-collaboration-response-invalid', `${field} must be a full SHA`); return normalized; }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const nested of Object.values(value)) freeze(nested); return Object.freeze(value); }
function encodePath(value) { return String(value).split('/').map(encodeURIComponent).join('/'); }

export function createGitHubCollaborationService({ fetchImpl = globalThis.fetch, githubAppProvider, apiBaseUrl = 'https://api.github.com', clock = () => new Date(), maxReviewThreads = 100 } = {}) {
  if (typeof fetchImpl !== 'function' || typeof clock !== 'function' || !Number.isInteger(maxReviewThreads) || maxReviewThreads < 1 || maxReviewThreads > 100) throw new TypeError('invalid collaboration dependency');
  if (!githubAppProvider?.withInstallationToken) throw new TypeError('githubAppProvider.withInstallationToken is required');
  const base = required(apiBaseUrl, 'apiBaseUrl').replace(/\/+$/u, '');
  const root = (repository) => `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`;

  async function request(path, { token, method = 'GET', body = null, allowNotFound = false } = {}) {
    let response;
    try { response = await fetchImpl(`${base}${path}`, { method, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'sg-gh3-collaboration', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
    catch { fail('gh3-collaboration-provider-unavailable', 'GitHub collaboration operation failed', { retryable: true }); }
    if (allowNotFound && response?.status === 404) return null;
    if (response?.status === 403) fail('gh3-collaboration-permission-denied', 'GitHub collaboration permission is unavailable', { status: 403 });
    if (!response?.ok) fail(`gh3-collaboration-http-${response?.status ?? 'unknown'}`, 'GitHub collaboration operation was not successful', { status: response?.status ?? null, retryable: response?.status >= 500 });
    if (response.status === 204) return null;
    try { return await response.json(); } catch { fail('gh3-collaboration-response-invalid', 'GitHub collaboration operation returned invalid JSON'); }
  }

  function authorized({ connectionId, repository: input, capability, permission, operation }) {
    const repository = createGitHubRepositoryIdentity(input);
    return githubAppProvider.withInstallationToken({ connectionId: required(connectionId, 'connectionId'), capability, repository, requiredProviderPermission: permission, operation: (token) => operation({ token, repository }) });
  }

  async function upsertPullRequest({ connectionId, repository, baseBranch, headBranch, title, body = '', draft = true, pullNumber = null, idempotencyKey } = {}) {
    const baseName = required(baseBranch, 'baseBranch'); const headName = required(headBranch, 'headBranch'); const key = required(idempotencyKey, 'idempotencyKey');
    if (baseName === headName) fail('gh3-collaboration-ref-conflict', 'pull request base and head must differ');
    return authorized({ connectionId, repository, capability: 'github.pull-request.write', permission: 'pull_requests', operation: async ({ token, repository: repo }) => {
      const open = await request(`${root(repo)}/pulls?state=open&base=${encodeURIComponent(baseName)}&head=${encodeURIComponent(`${repo.owner}:${headName}`)}&per_page=10`, { token });
      const matches = Array.isArray(open) ? open.filter((item) => item?.base?.ref === baseName && item?.head?.ref === headName && item?.head?.repo?.full_name === repo.fullName) : [];
      if (matches.length > 1) fail('gh3-collaboration-ambiguous-retry', 'multiple canonical pull requests match base and head');
      if (pullNumber && matches[0] && matches[0].number !== pullNumber) fail('gh3-collaboration-identity-conflict', 'pull request number does not match canonical base/head');
      const marker = `<!-- sg-idempotency:${key} -->`; const nextBody = `${String(body).trim()}${body ? '\n\n' : ''}${marker}`;
      const existing = matches[0] ?? (pullNumber ? await request(`${root(repo)}/pulls/${integer(pullNumber, 'pullNumber')}`, { token, allowNotFound: true }) : null);
      if (existing && (existing?.base?.ref !== baseName || existing?.head?.ref !== headName || existing?.head?.repo?.full_name !== repo.fullName)) fail('gh3-collaboration-identity-conflict', 'pull request does not match canonical base/head repository');
      if (existing?.body?.includes(marker) && existing?.title === required(title, 'title')) return freeze({ repository: repo, pullNumber: existing.number, url: existing.html_url, reused: true, mutated: false, baseBranch: baseName, headBranch: headName });
      const payload = { title: required(title, 'title'), body: nextBody, base: baseName, ...(existing ? {} : { head: headName, draft: Boolean(draft) }) };
      const result = await request(existing ? `${root(repo)}/pulls/${existing.number}` : `${root(repo)}/pulls`, { token, method: existing ? 'PATCH' : 'POST', body: payload });
      return freeze({ repository: repo, pullNumber: integer(result?.number, 'result.number'), url: result?.html_url ?? null, reused: false, mutated: true, baseBranch: baseName, headBranch: headName, audit: { operation: existing ? 'pull-request-update' : 'pull-request-create', idempotencyKey: key, observedAt: clock().toISOString() } });
    } });
  }

  async function readReviewThreads({ connectionId, repository, pullNumber } = {}) {
    return authorized({ connectionId, repository, capability: 'github.review.read', permission: 'pull_requests', operation: async ({ token, repository: repo }) => {
      const number = integer(pullNumber, 'pullNumber'); const [reviews, comments] = await Promise.all([request(`${root(repo)}/pulls/${number}/reviews?per_page=100`, { token }), request(`${root(repo)}/pulls/${number}/comments?per_page=100`, { token })]);
      const bounded = (Array.isArray(comments) ? comments : []).slice(0, maxReviewThreads).map((comment) => ({ commentId: comment.id, reviewId: comment.pull_request_review_id ?? null, path: comment.path ?? null, line: comment.line ?? comment.original_line ?? null, inReplyToId: comment.in_reply_to_id ?? null, body: String(comment.body ?? ''), author: comment.user?.login ?? null, url: comment.html_url ?? null }));
      return freeze({ repository: repo, pullNumber: number, reviews: (Array.isArray(reviews) ? reviews : []).slice(0, maxReviewThreads), comments: bounded, truncated: (comments?.length ?? 0) > bounded.length, untrustedExternalData: true });
    } });
  }

  async function replyToReview({ connectionId, repository, pullNumber, commentId, body, idempotencyKey } = {}) {
    return authorized({ connectionId, repository, capability: 'github.review.write', permission: 'pull_requests', operation: async ({ token, repository: repo }) => {
      const number = integer(pullNumber, 'pullNumber'); const parent = integer(commentId, 'commentId'); const key = required(idempotencyKey, 'idempotencyKey');
      const comments = await request(`${root(repo)}/pulls/${number}/comments?per_page=100`, { token }); const marker = `<!-- sg-idempotency:${key} -->`;
      const duplicate = (Array.isArray(comments) ? comments : []).find((item) => item?.in_reply_to_id === parent && String(item?.body ?? '').includes(marker));
      if (duplicate) return freeze({ repository: repo, pullNumber: number, commentId: duplicate.id, reused: true, mutated: false });
      const result = await request(`${root(repo)}/pulls/${number}/comments/${parent}/replies`, { token, method: 'POST', body: { body: `${required(body, 'body')}\n\n${marker}` } });
      return freeze({ repository: repo, pullNumber: number, commentId: result.id, reused: false, mutated: true });
    } });
  }

  async function resolveReviewThread({ connectionId, repository, threadNodeId, separateApproval } = {}) {
    if (separateApproval !== true) fail('gh3-collaboration-separate-approval-required', 'review thread resolution requires explicit approval');
    return authorized({ connectionId, repository, capability: 'github.review.write', permission: 'pull_requests', operation: async ({ token, repository: repo }) => {
      const threadId = required(threadNodeId, 'threadNodeId');
      const result = await request('/graphql', { token, method: 'POST', body: { query: 'mutation ResolveReviewThread($threadId: ID!) { resolveReviewThread(input: {threadId: $threadId}) { thread { id isResolved repository { nameWithOwner } } } }', variables: { threadId } } });
      if (result?.errors?.length) fail('gh3-collaboration-graphql-rejected', 'GitHub rejected review thread resolution');
      const thread = result?.data?.resolveReviewThread?.thread;
      if (thread?.id !== threadId || thread?.repository?.nameWithOwner !== repo.fullName || thread?.isResolved !== true) fail('gh3-collaboration-response-invalid', 'resolved review thread identity is invalid');
      return freeze({ repository: repo, threadNodeId: threadId, resolved: true, mutated: true });
    } });
  }

  async function upsertIssue({ connectionId, repository, issueNumber = null, title, body = '', labels = [], milestone = null, idempotencyKey } = {}) {
    return authorized({ connectionId, repository, capability: 'github.issue.write', permission: 'issues', operation: async ({ token, repository: repo }) => {
      const key = required(idempotencyKey, 'idempotencyKey'); const marker = `<!-- sg-idempotency:${key} -->`; let existing = issueNumber ? await request(`${root(repo)}/issues/${integer(issueNumber, 'issueNumber')}`, { token, allowNotFound: true }) : null;
      if (!existing) { const candidates = await request(`${root(repo)}/issues?state=all&per_page=100`, { token }); const matches = (Array.isArray(candidates) ? candidates : []).filter((item) => !item.pull_request && String(item.body ?? '').includes(marker)); if (matches.length > 1) fail('gh3-collaboration-ambiguous-retry', 'multiple issues match the idempotency key'); existing = matches[0] ?? null; }
      const payload = { title: required(title, 'title'), body: `${String(body).trim()}${body ? '\n\n' : ''}${marker}`, labels: Array.isArray(labels) ? [...new Set(labels.map((item) => required(item, 'label')))] : fail('gh3-collaboration-input-invalid', 'labels must be an array'), ...(milestone === null ? {} : { milestone: integer(milestone, 'milestone') }) };
      if (existing && existing.title === payload.title && String(existing.body ?? '').includes(marker)) return freeze({ repository: repo, issueNumber: existing.number, reused: true, mutated: false });
      const result = await request(existing ? `${root(repo)}/issues/${existing.number}` : `${root(repo)}/issues`, { token, method: existing ? 'PATCH' : 'POST', body: payload });
      return freeze({ repository: repo, issueNumber: integer(result?.number, 'result.number'), reused: false, mutated: true });
    } });
  }

  async function createTagAndRelease({ connectionId, repository, tagName, targetSha, title, notes = '', draft = true, prerelease = false, idempotencyKey, separateApproval } = {}) {
    if (separateApproval !== true) fail('gh3-collaboration-separate-approval-required', 'release creation requires separate approval');
    const tag = required(tagName, 'tagName'); const target = fullSha(targetSha, 'targetSha'); const key = required(idempotencyKey, 'idempotencyKey');
    return authorized({ connectionId, repository, capability: 'github.release.write', permission: 'contents', operation: async ({ token, repository: repo }) => {
      const existingRelease = await request(`${root(repo)}/releases/tags/${encodePath(tag)}`, { token, allowNotFound: true });
      const existingRef = await request(`${root(repo)}/git/ref/tags/${encodePath(tag)}`, { token, allowNotFound: true });
      if (existingRef && fullSha(existingRef?.object?.sha, 'tagRef.object.sha') !== target) fail('gh3-collaboration-tag-conflict', 'tag already points to another target');
      const marker = `<!-- sg-idempotency:${key} -->`;
      if (existingRelease) { if (existingRelease?.target_commitish !== target || !String(existingRelease?.body ?? '').includes(marker)) fail('gh3-collaboration-release-conflict', 'release already exists with different identity'); return freeze({ repository: repo, releaseId: existingRelease.id, tagName: tag, targetSha: target, reused: true, mutated: false }); }
      if (!existingRef) await request(`${root(repo)}/git/refs`, { token, method: 'POST', body: { ref: `refs/tags/${tag}`, sha: target } });
      const release = await request(`${root(repo)}/releases`, { token, method: 'POST', body: { tag_name: tag, target_commitish: target, name: required(title, 'title'), body: `${String(notes).trim()}${notes ? '\n\n' : ''}${marker}`, draft: Boolean(draft), prerelease: Boolean(prerelease) } });
      return freeze({ repository: repo, releaseId: release.id, url: release.html_url ?? null, tagName: tag, targetSha: target, reused: false, mutated: true });
    } });
  }

  return Object.freeze({ upsertPullRequest, readReviewThreads, replyToReview, resolveReviewThread, upsertIssue, createTagAndRelease });
}
