import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createDirectGitHubApi } from '../src/integrations/github/githubCapability.js';
import { resetGitHubAppAccessCacheForTests } from '../src/integrations/github/appAuth.js';

const REPOSITORY = 'korzh260609-beep/garya-bot';
const BRANCH = 'dev/sg2.1-semantic';
const HEAD = '1111111111111111111111111111111111111111';
const MOVED_HEAD = '9999999999999999999999999999999999999999';
const PRIVATE_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const APP_ENV = Object.freeze({ GITHUB_APP_ID: '123', GITHUB_APP_INSTALLATION_ID: '456', GITHUB_APP_PRIVATE_KEY: PRIVATE_KEY });

function response(body, status = 200) {
  return Object.freeze({ ok: status >= 200 && status < 300, status, async json() { return body; } });
}

function github(fetchImpl) {
  return createDirectGitHubApi({
    repository: REPOSITORY,
    branch: BRANCH,
    env: APP_ENV,
    fetchImpl
  });
}

test('repository discovery fails closed when GitHub reports a truncated recursive tree', async () => {
  resetGitHubAppAccessCacheForTests();
  const fetchImpl = async (url) => {
    const parsed = new URL(String(url));
    const path = `${parsed.pathname}${parsed.search}`;
    if (path === '/app/installations/456/access_tokens') return response({ token: 'installation-token', expires_at: '2099-01-01T00:00:00Z' });
    if (path === `/repos/${REPOSITORY}/commits/${encodeURIComponent(BRANCH)}`) return response({ sha: HEAD });
    if (path === `/repos/${REPOSITORY}/git/trees/${HEAD}?recursive=1`) return response({ truncated: true, tree: [] });
    throw new Error(`unexpected request: ${path}`);
  };

  await assert.rejects(() => github(fetchImpl).tree(), (error) => error?.code === 'github-tree-truncated');
});

test('atomic commit refuses to write when branch HEAD changed after evidence collection', async () => {
  resetGitHubAppAccessCacheForTests();
  let headReads = 0;
  let mutationAttempted = false;
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(String(url));
    const path = `${parsed.pathname}${parsed.search}`;
    const method = options.method ?? 'GET';
    if (path === '/app/installations/456/access_tokens' && method === 'POST') return response({ token: 'installation-token', expires_at: '2099-01-01T00:00:00Z' });
    if (path === `/repos/${REPOSITORY}/commits/${encodeURIComponent(BRANCH)}` && method === 'GET') {
      headReads += 1;
      return response({ sha: headReads === 1 ? HEAD : MOVED_HEAD });
    }
    if (method !== 'GET') mutationAttempted = true;
    throw new Error(`unexpected request: ${method} ${path}`);
  };

  const repository = github(fetchImpl);
  const baselineHead = await repository.head();
  await assert.rejects(
    () => repository.commit({ baselineHead, message: 'test: must not commit stale evidence', changes: [{ operation: 'create', path: 'src/new.js', content: 'export const value = 1;' }] }),
    (error) => error?.code === 'github-stale-head'
  );
  assert.equal(mutationAttempted, false);
});
