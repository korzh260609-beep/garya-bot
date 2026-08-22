import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubRepositoryClient } from '../src/githubDevelopment/githubDevelopmentRuntime.js';

const REPOSITORY = 'korzh260609-beep/garya-bot';
const BRANCH = 'dev/sg2.1-semantic';
const HEAD = '1111111111111111111111111111111111111111';
const MOVED_HEAD = '9999999999999999999999999999999999999999';

function response(body, status = 200) {
  return Object.freeze({ ok: status >= 200 && status < 300, status, async json() { return body; } });
}

function client(fetchImpl) {
  return createGitHubRepositoryClient({
    repository: REPOSITORY,
    branch: BRANCH,
    credentialProvider: { token: async () => 'token' },
    fetchImpl
  });
}

test('repository discovery fails closed when GitHub reports a truncated recursive tree', async () => {
  const fetchImpl = async (url) => {
    const parsed = new URL(String(url));
    const path = `${parsed.pathname}${parsed.search}`;
    if (path === `/repos/${REPOSITORY}/commits/${encodeURIComponent(BRANCH)}`) return response({ sha: HEAD });
    if (path === `/repos/${REPOSITORY}/git/trees/${HEAD}?recursive=1`) return response({ truncated: true, tree: [] });
    throw new Error(`unexpected request: ${path}`);
  };

  await assert.rejects(() => client(fetchImpl).tree(), (error) => error?.code === 'github-tree-truncated');
});

test('atomic commit refuses to write when branch HEAD changed after evidence collection', async () => {
  let headReads = 0;
  let mutationAttempted = false;
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(String(url));
    const path = `${parsed.pathname}${parsed.search}`;
    const method = options.method ?? 'GET';
    if (path === `/repos/${REPOSITORY}/commits/${encodeURIComponent(BRANCH)}` && method === 'GET') {
      headReads += 1;
      return response({ sha: headReads === 1 ? HEAD : MOVED_HEAD });
    }
    if (method !== 'GET') mutationAttempted = true;
    throw new Error(`unexpected request: ${method} ${path}`);
  };

  const repository = client(fetchImpl);
  const baselineHead = await repository.head();
  await assert.rejects(
    () => repository.commit({ baselineHead, message: 'test: must not commit stale evidence', changes: [{ operation: 'create', path: 'src/new.js', content: 'export const value = 1;' }] }),
    (error) => error?.code === 'github-stale-head'
  );
  assert.equal(mutationAttempted, false);
});
