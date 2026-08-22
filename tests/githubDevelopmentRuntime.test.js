import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubCredentialProvider, createGitHubRepositoryClient, createGitHubDevelopmentRuntime } from '../src/githubDevelopment/githubDevelopmentRuntime.js';

const REPOSITORY = 'korzh260609-beep/garya-bot';
const BRANCH = 'dev/sg2.1-semantic';
const HEAD = '1111111111111111111111111111111111111111';
const BASE_TREE = '2222222222222222222222222222222222222222';
const BLOB = '3333333333333333333333333333333333333333';
const NEXT_TREE = '4444444444444444444444444444444444444444';
const NEXT_COMMIT = '5555555555555555555555555555555555555555';

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

test('GitHub credential provider uses a deployment token directly and does not expose a connectionId contract', async () => {
  const provider = createGitHubCredentialProvider({ env: { GITHUB_TOKEN: 'token-value' }, fetchImpl: async () => { throw new Error('must not mint app token'); } });
  assert.equal(provider.configured, true);
  assert.equal(provider.authentication, 'deployment-token');
  assert.equal(await provider.token(), 'token-value');
  assert.equal(Object.hasOwn(provider, 'connectionId'), false);
});

test('repository client rejects protected default branches', () => {
  const credentials = { token: async () => 'token' };
  assert.throws(() => createGitHubRepositoryClient({ repository: REPOSITORY, branch: 'main', credentialProvider: credentials, fetchImpl: async () => response({}) }), /protected default branch/u);
});

test('single GitHub development runtime reports exact configured branch without connectionId', async () => {
  const { fetchImpl } = createFetch();
  const runtime = createGitHubDevelopmentRuntime({ env: { GITHUB_TOKEN: 'token', SG_GITHUB_DEVELOPMENT_REPOSITORY: REPOSITORY, SG_GITHUB_DEVELOPMENT_BRANCH: BRANCH }, ownerGlobalUserId: 'owner-1', aiRouter: { async route() { throw new Error('status must not use AI'); } }, fetchImpl });
  assert.equal(runtime.availability.connectionIdRequired, false);
  await runtime.start();
  const result = await runtime.capability.execute(request({ mode: 'status', canonicalAction: 'github.repository.inspect' }));
  assert.equal(result.status, 'success');
  assert.equal(result.data.exactHead, HEAD);
  assert.match(result.data.message, /dev\/sg2\.1-semantic/u);
});

test('development execution reads exact evidence, makes an atomic commit, and returns pending exact-head CI evidence', async () => {
  const { fetchImpl, calls } = createFetch({ mutable: true });
  const aiRouter = {
    async route(input) {
      if (input.task === 'github-development-file-selection') return { text: JSON.stringify({ files: ['src/example.js'] }) };
      if (input.task === 'github-development-change-plan') return { text: JSON.stringify({ summary: 'Updated example value', commitMessage: 'test: update example value', changes: [{ operation: 'update', path: 'src/example.js', content: 'export const oldValue = 2;' }] }) };
      throw new Error(`unexpected AI task: ${input.task}`);
    }
  };
  const runtime = createGitHubDevelopmentRuntime({ env: { GITHUB_TOKEN: 'token', SG_GITHUB_DEVELOPMENT_REPOSITORY: REPOSITORY, SG_GITHUB_DEVELOPMENT_BRANCH: BRANCH }, ownerGlobalUserId: 'owner-1', aiRouter, fetchImpl });
  const result = await runtime.capability.execute(request({ mode: 'execute', canonicalAction: 'github.development.execute', instruction: 'Обнови пример' }));
  assert.equal(result.status, 'success');
  assert.equal(result.data.commitSha, NEXT_COMMIT);
  assert.deepEqual(result.data.changedPaths, ['src/example.js']);
  assert.equal(result.data.ci.pending, true);
  assert.equal(result.data.ci.exactHead, NEXT_COMMIT);
  assert.ok(calls.some((item) => item.method === 'PATCH' && item.path.includes('/git/refs/heads/dev/sg2.1-semantic')));
  assert.ok(calls.every((item) => item.authorization === 'Bearer token'));
});

test('runtime denies non-owner execution before repository access', async () => {
  let fetched = false;
  const runtime = createGitHubDevelopmentRuntime({ env: { GITHUB_TOKEN: 'token', SG_GITHUB_DEVELOPMENT_REPOSITORY: REPOSITORY, SG_GITHUB_DEVELOPMENT_BRANCH: BRANCH }, ownerGlobalUserId: 'owner-1', aiRouter: { async route() { throw new Error('not expected'); } }, fetchImpl: async () => { fetched = true; throw new Error('not expected'); } });
  const result = await runtime.capability.execute({ ...request({ mode: 'execute', instruction: 'change' }), actor: { globalUserId: 'other', roles: ['citizen'] } });
  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'github-owner-required');
  assert.equal(fetched, false);
});
