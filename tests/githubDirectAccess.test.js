import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createDirectGitHubApi, createGitHubAccess } from '../src/integrations/github/githubAccess.js';
import { getGitHubAppAccess, resetGitHubAppAccessCacheForTests } from '../src/integrations/github/appAuth.js';

const REPOSITORY = 'korzh260609-beep/garya-bot';
const BRANCH = 'dev/sg2.1-semantic';
const HEAD = '1111111111111111111111111111111111111111';
const BASE_TREE = '2222222222222222222222222222222222222222';
const BLOB = '3333333333333333333333333333333333333333';
const NEXT_TREE = '4444444444444444444444444444444444444444';
const NEXT_COMMIT = '5555555555555555555555555555555555555555';
const PRIVATE_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const APP_ENV = Object.freeze({ GITHUB_APP_ID: '123', GITHUB_APP_INSTALLATION_ID: '456', GITHUB_APP_PRIVATE_KEY: PRIVATE_KEY, GITHUB_REPO: REPOSITORY, GITHUB_BRANCH: BRANCH });

function response(body, status = 200) {
  return Object.freeze({ ok: status >= 200 && status < 300, status, async json() { return body; } });
}

function createFetch({ mutable = false } = {}) {
  const calls = [];
  let head = HEAD;
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(String(url));
    const path = `${parsed.pathname}${parsed.search}`;
    const method = options.method ?? 'GET';
    calls.push({ path, method, authorization: options.headers?.Authorization, body: options.body ? JSON.parse(options.body) : null });
    if (path === '/app/installations/456/access_tokens' && method === 'POST') return response({ token: 'installation-token', expires_at: '2099-01-01T00:00:00Z' });
    if (path === `/repos/${REPOSITORY}/commits/${encodeURIComponent(BRANCH)}` && method === 'GET') return response({ sha: head });
    if (path === `/repos/${REPOSITORY}/git/trees/${HEAD}?recursive=1` && method === 'GET') return response({ truncated: false, tree: [{ path: 'src/example.js', type: 'blob', sha: BLOB, size: 20 }] });
    if (path === `/repos/${REPOSITORY}/contents/src/example.js?ref=${HEAD}` && method === 'GET') return response({ type: 'file', sha: BLOB, encoding: 'base64', content: Buffer.from('export const oldValue = 1;').toString('base64') });
    if (path === `/repos/${REPOSITORY}/git/commits/${HEAD}` && method === 'GET') return response({ sha: HEAD, tree: { sha: BASE_TREE } });
    if (path === `/repos/${REPOSITORY}/git/blobs` && method === 'POST') return response({ sha: BLOB });
    if (path === `/repos/${REPOSITORY}/git/trees` && method === 'POST') return response({ sha: NEXT_TREE });
    if (path === `/repos/${REPOSITORY}/git/commits` && method === 'POST') return response({ sha: NEXT_COMMIT });
    if (path === `/repos/${REPOSITORY}/git/refs/heads/dev/sg2.1-semantic` && method === 'PATCH') { if (mutable) head = NEXT_COMMIT; return response({ object: { sha: NEXT_COMMIT } }); }
    if (path === `/repos/${REPOSITORY}/actions/runs?branch=${encodeURIComponent(BRANCH)}&head_sha=${NEXT_COMMIT}&per_page=20` && method === 'GET') return response({ workflow_runs: [{ id: 7, name: 'CI', status: 'queued', conclusion: null, head_sha: NEXT_COMMIT, html_url: 'https://github.example/run/7' }] });
    throw new Error(`unexpected GitHub request: ${method} ${path}`);
  };
  return { fetchImpl, calls };
}

function request(input = {}) {
  return Object.freeze({
    input: Object.freeze({ locale: 'ru', ...input }),
    actor: Object.freeze({ globalUserId: 'owner-1', roles: Object.freeze(['monarch']) }),
    scope: Object.freeze({ projectScope: 'sg2.1' }),
    traceContext: Object.freeze({ traceId: 'trace-1', requestId: 'request-1' }),
    actionRequest: Object.freeze({ actionType: input.mode === 'status' ? 'github-development-status' : 'github-development' })
  });
}

test('SG 2.0 appAuth mints and caches a short-lived GitHub App installation token', async () => {
  resetGitHubAppAccessCacheForTests();
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return response({ token: 'installation-token', expires_at: '2099-01-01T00:00:00Z' }); };
  assert.equal(await getGitHubAppAccess({ env: APP_ENV, fetchImpl }), 'installation-token');
  assert.equal(await getGitHubAppAccess({ env: APP_ENV, fetchImpl }), 'installation-token');
  assert.equal(calls, 1);
});

test('direct GitHub API rejects protected default branches', () => {
  assert.throws(() => createDirectGitHubApi({ repository: REPOSITORY, branch: 'main', env: APP_ENV, fetchImpl: async () => response({}) }), /protected default branch/u);
});

test('GitHub capability reports the exact configured branch through direct App API access', async () => {
  resetGitHubAppAccessCacheForTests();
  const { fetchImpl } = createFetch();
  const github = createGitHubAccess({ env: APP_ENV, ownerGlobalUserId: 'owner-1', aiRouter: { async route() { throw new Error('status must not use AI'); } }, fetchImpl });
  await github.start();
  const result = await github.executeRequest(request({ mode: 'status', canonicalAction: 'github.repository.inspect' }));
  assert.equal(result.status, 'success');
  assert.equal(result.data.exactHead, HEAD);
  assert.match(result.data.message, /dev\/sg2\.1-semantic/u);
});

test('development execution reads exact evidence, makes an atomic commit, and returns pending exact-head CI evidence', async () => {
  resetGitHubAppAccessCacheForTests();
  const { fetchImpl, calls } = createFetch({ mutable: true });
  const aiRouter = {
    async route(input) {
      if (input.task === 'github-development-file-selection') return { text: JSON.stringify({ files: ['src/example.js'] }) };
      if (input.task === 'github-development-change-plan') return { text: JSON.stringify({ summary: 'Updated example value', commitMessage: 'test: update example value', changes: [{ operation: 'update', path: 'src/example.js', content: 'export const oldValue = 2;' }] }) };
      throw new Error(`unexpected AI task: ${input.task}`);
    }
  };
  const github = createGitHubAccess({ env: APP_ENV, ownerGlobalUserId: 'owner-1', aiRouter, fetchImpl });
  const result = await github.executeRequest(request({ mode: 'execute', canonicalAction: 'github.development.execute', instruction: 'Обнови пример' }));
  assert.equal(result.status, 'success');
  assert.equal(result.data.commitSha, NEXT_COMMIT);
  assert.deepEqual(result.data.changedPaths, ['src/example.js']);
  assert.equal(result.data.ci.pending, true);
  assert.equal(result.data.ci.exactHead, NEXT_COMMIT);
  assert.ok(calls.some((item) => item.method === 'PATCH' && item.path.includes('/git/refs/heads/dev/sg2.1-semantic')));
  assert.ok(calls.filter((item) => item.path.startsWith('/repos/')).every((item) => item.authorization === 'Bearer installation-token'));
});

test('capability denies non-owner execution before repository access', async () => {
  let fetched = false;
  const github = createGitHubAccess({ env: APP_ENV, ownerGlobalUserId: 'owner-1', aiRouter: { async route() { throw new Error('not expected'); } }, fetchImpl: async () => { fetched = true; throw new Error('not expected'); } });
  const result = await github.executeRequest({ ...request({ mode: 'execute', instruction: 'change' }), actor: { globalUserId: 'other', roles: ['citizen'] } });
  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'github-owner-required');
  assert.equal(fetched, false);
});
