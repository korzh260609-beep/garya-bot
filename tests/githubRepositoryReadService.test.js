import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubRepositoryReadService } from '../src/projectDevelopmentKnowledge/githubRepositoryReadService.js';

const HEAD = '1111111111111111111111111111111111111111';
const TREE = '2222222222222222222222222222222222222222';
const REPO = 'korzh260609-beep/garya-bot';
const BRANCH = 'dev/sg2.1-semantic';

function response(body, status = 200) {
  return Object.freeze({ ok: status >= 200 && status < 300, status, async json() { return body; } });
}

test('PDK4 repository read service uses the configured credential and returns an immutable current snapshot', async () => {
  const credentialCalls = [];
  const requests = [];
  const credentialManager = Object.freeze({
    async useCredential(input) {
      credentialCalls.push(input);
      return input.operation('secret-token-never-exposed');
    }
  });
  const credentialAccessContext = Object.freeze({ actor: Object.freeze({ globalUserId: 'system:runtime' }), scope: Object.freeze({ projectScope: 'sg2.1' }) });
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method, authorization: options.headers?.Authorization });
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}`;
    if (path === `/repos/${REPO}/commits/${encodeURIComponent(BRANCH)}`) {
      return response({ sha: HEAD, commit: { tree: { sha: TREE }, committer: { date: '2026-08-16T11:10:46Z' }, message: 'head commit' } });
    }
    if (path === `/repos/${REPO}/git/trees/${TREE}?recursive=1`) {
      return response({ truncated: false, tree: [
        { type: 'blob', path: 'README.md', sha: 'a' },
        { type: 'blob', path: 'src/runtime/createProductionRuntime.js', sha: 'b' }
      ] });
    }
    if (path === `/repos/${REPO}/commits?sha=${encodeURIComponent(BRANCH)}&per_page=2&page=1`) {
      return response([{ sha: HEAD }]);
    }
    if (path === `/repos/${REPO}/commits/${HEAD}`) {
      return response({
        sha: HEAD,
        commit: { committer: { date: '2026-08-16T11:10:46Z' }, author: { name: 'SG' }, message: 'fix repository analysis' },
        files: [{ filename: 'src/runtime/createProductionRuntime.js', status: 'modified', additions: 10, deletions: 2, patch: '@@ runtime patch @@' }]
      });
    }
    if (path === `/repos/${REPO}/contents/README.md?ref=${HEAD}`) {
      return response({ type: 'file', sha: 'a', size: 12, encoding: 'base64', content: Buffer.from('# SG 2.1\n').toString('base64') });
    }
    if (path === `/repos/${REPO}/contents/src/runtime/createProductionRuntime.js?ref=${HEAD}`) {
      return response({ type: 'file', sha: 'b', size: 30, encoding: 'base64', content: Buffer.from('export function runtime() {}\n').toString('base64') });
    }
    return response({ message: `unexpected ${path}` }, 404);
  };

  const service = createGitHubRepositoryReadService({
    config: { repository: REPO, branch: BRANCH, credentialId: 'sg.github.pdk4', requestTimeoutMs: 5000 },
    credentialManager,
    credentialAccessContext,
    fetchImpl,
    maxRecentCommits: 2,
    maxRelevantFiles: 2
  });

  const snapshot = await service.snapshot({ query: 'current runtime development stage' });
  assert.equal(snapshot.repository, REPO);
  assert.equal(snapshot.branch, BRANCH);
  assert.equal(snapshot.head.sha, HEAD);
  assert.equal(snapshot.mutated, false);
  assert.equal(snapshot.tree.totalBlobCount, 2);
  assert.equal(snapshot.recentCommits.length, 1);
  assert.equal(snapshot.recentCommits[0].files[0].path, 'src/runtime/createProductionRuntime.js');
  assert.equal(snapshot.relevantFiles.length, 2);
  assert.match(snapshot.relevantFiles.map((file) => file.content).join('\n'), /SG 2\.1|runtime/);
  assert.deepEqual(snapshot.sources, [`github:${REPO}@${HEAD}`]);
  assert.equal(snapshot.evidence.bounded, true);
  assert.ok(JSON.stringify(snapshot).length <= snapshot.evidence.maxCharacters);

  assert.ok(credentialCalls.length >= 6);
  for (const call of credentialCalls) {
    assert.equal(call.credentialId, 'sg.github.pdk4');
    assert.equal(call.connectionId, 'github-pdk4');
    assert.equal(call.purpose, 'pdk4.github.repository.read');
  }
  assert.ok(requests.length >= 6);
  assert.ok(requests.every((request) => request.method === 'GET'));
  assert.ok(requests.every((request) => request.authorization === 'Bearer secret-token-never-exposed'));
});

test('PDK4 repository evidence remains useful and below its total composition budget for a large repository snapshot', async () => {
  const requests = [];
  const credentialManager = Object.freeze({ async useCredential(input) { return input.operation('secret-token-never-exposed'); } });
  const credentialAccessContext = Object.freeze({ actor: Object.freeze({ globalUserId: 'system:runtime' }), scope: Object.freeze({ projectScope: 'sg2.1' }) });
  const tree = Array.from({ length: 180 }, (_, index) => ({ type: 'blob', path: `src/module-${String(index).padStart(3, '0')}.js`, sha: `blob-${index}` }));
  tree.unshift({ type: 'blob', path: 'README.md', sha: 'readme' });
  const commits = Array.from({ length: 8 }, (_, index) => ({ sha: String(index + 1).repeat(40).slice(0, 40) }));
  const hugeContent = `${'export const evidence = true;\n'.repeat(500)}PDK4.13 LIVE ACCEPTANCE NOT CLOSED\n`;
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method });
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}`;
    if (path === `/repos/${REPO}/commits/${encodeURIComponent(BRANCH)}`) return response({ sha: HEAD, commit: { tree: { sha: TREE }, message: 'current head PDK4.13' } });
    if (path === `/repos/${REPO}/git/trees/${TREE}?recursive=1`) return response({ truncated: false, tree });
    if (path === `/repos/${REPO}/commits?sha=${encodeURIComponent(BRANCH)}&per_page=8&page=1`) return response(commits);
    const commit = commits.find((row) => path === `/repos/${REPO}/commits/${row.sha}`);
    if (commit) return response({ sha: commit.sha, commit: { author: { name: 'SG' }, message: `PDK4.13 repository work ${'x'.repeat(500)}` }, files: Array.from({ length: 30 }, (_, index) => ({ filename: `src/module-${String(index).padStart(3, '0')}.js`, status: 'modified', additions: 25, deletions: 3, patch: 'p'.repeat(5000) })) });
    if (path.startsWith(`/repos/${REPO}/contents/`) && path.endsWith(`?ref=${HEAD}`)) return response({ type: 'file', sha: 'file', size: hugeContent.length, encoding: 'base64', content: Buffer.from(hugeContent).toString('base64') });
    return response({ message: `unexpected ${path}` }, 404);
  };

  const service = createGitHubRepositoryReadService({
    config: { repository: REPO, branch: BRANCH, credentialId: 'sg.github.pdk4', requestTimeoutMs: 5000 },
    credentialManager,
    credentialAccessContext,
    fetchImpl,
    maxEvidenceCharacters: 5000
  });
  const snapshot = await service.snapshot({ query: 'Проверь мой репозиторий и скажи, на каком этапе сейчас разработка СГ 2.1' });
  const serialized = JSON.stringify(snapshot);
  assert.ok(serialized.length <= 5000, `repository evidence must be <= 5000 characters, got ${serialized.length}`);
  assert.equal(snapshot.head.sha, HEAD);
  assert.equal(snapshot.repository, REPO);
  assert.equal(snapshot.branch, BRANCH);
  assert.equal(snapshot.mutated, false);
  assert.equal(snapshot.evidence.bounded, true);
  assert.equal(snapshot.evidence.truncated, true);
  assert.ok(snapshot.tree.totalBlobCount >= 180);
  assert.ok(snapshot.recentCommits.length >= 1);
  assert.deepEqual(snapshot.sources, [`github:${REPO}@${HEAD}`]);
  assert.ok(requests.length > 10);
  assert.ok(requests.every((request) => request.method === 'GET'));
});

test('capability registry replacement is explicit and requires an existing capability', async () => {
  const { createCapabilityRegistry } = await import('../src/capability/capabilityRegistry.js');
  const original = Object.freeze({
    name: 'repository-analyze', version: '1.0.0', description: 'fixture', actionTypes: Object.freeze(['repository-analyze']), actionClasses: Object.freeze(['read-only']),
    requiredPermissions: Object.freeze(['capability:repository-analyze']), requiredSources: Object.freeze([]), requiredTools: Object.freeze([]), risk: 'low', estimatedCostUsd: 0,
    confirmationRequired: false, timeoutMs: 1000, maxRetries: 0, fallbackCapabilities: Object.freeze([]), priority: 0, async execute() { return { status: 'success' }; }
  });
  const registry = createCapabilityRegistry({ capabilities: [original] });
  const replacement = registry.replace({ ...original, description: 'live-read', async execute() { return { status: 'success', data: { live: true } }; } });
  assert.equal(registry.get('repository-analyze'), replacement);
  assert.equal(replacement.description, 'live-read');
  assert.throws(() => registry.replace({ ...original, name: 'missing' }), /not registered/);
});
