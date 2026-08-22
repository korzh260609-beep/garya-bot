import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubRepositoryReadAnalysisService } from '../src/githubDevelopment/githubRepositoryReadAnalysisService.js';

const REVISION = 'a'.repeat(40);
const OTHER_REVISION = 'b'.repeat(40);
function response(body, status = 200) { return { ok: status >= 200 && status < 300, status, async json() { return body; } }; }
function bodyFor(url, overrides = {}) {
  const parsed = new URL(url);
  const path = parsed.pathname;
  if (overrides[path]) return overrides[path];
  if (path === '/repos/acme/project') return { id: 7, full_name: 'acme/project', default_branch: 'main', private: false };
  if (path === `/repos/acme/project/commits/${REVISION}`) return { sha: REVISION };
  if (path === `/repos/acme/project/git/trees/${REVISION}`) return { tree: [] };
  if (path === '/repos/acme/project/commits' && parsed.searchParams.has('sha')) return [{ sha: REVISION }];
  if (path === '/repos/acme/project/commits') return [];
  if (path === '/repos/acme/project/issues') return [];
  if (path === '/repos/acme/project/pulls') return [];
  if (path === `/repos/acme/project/commits/${REVISION}/check-runs`) return { check_runs: [] };
  if (path === '/repos/acme/project/actions/runs') return { workflow_runs: [] };
  throw new Error(`unexpected URL ${url}`);
}
function serviceWith({ overrides = {}, onRequest = () => {}, ...options } = {}) {
  return createGitHubRepositoryReadAnalysisService({ ...options, fetchImpl: async (url, init) => { onRequest(url, init); return response(bodyFor(url, overrides)); }, clock: () => new Date('2026-08-20T10:00:00Z') });
}
const input = { repository: { owner: 'acme', name: 'project', repositoryId: '7' }, ref: { kind: 'branch', name: 'main' } };

test('moving branch resolves once and all correctness-sensitive reads bind to immutable SHA', async () => {
  const urls = [];
  const result = await serviceWith({ onRequest: (url) => urls.push(decodeURIComponent(url)) }).readSnapshot(input);
  assert.equal(result.revision, REVISION);
  assert.equal(result.provenance.source, `github:acme/project@${REVISION}`);
  assert.equal(result.provenance.immutableRevisionVerified, true);
  assert.equal(urls.filter((url) => url.includes('commits?sha=main&per_page=1')).length, 1);
  assert.ok(urls.some((url) => url.includes(`/git/trees/${REVISION}`)));
  assert.ok(urls.some((url) => url.includes(`commits?sha=${REVISION}`)));
  assert.ok(urls.some((url) => url.includes(`actions/runs?head_sha=${REVISION}`)));
});

test('branch names containing slashes resolve through the SG 2.0-compatible ref query', async () => {
  const urls = [];
  const result = await serviceWith({ onRequest: (url) => urls.push(url) }).readSnapshot({ ...input, ref: { kind: 'branch', name: 'dev/task' } });
  assert.equal(result.revision, REVISION);
  assert.ok(urls.some((url) => url.includes('/commits?sha=dev%2Ftask&per_page=1')));
  assert.equal(urls.some((url) => url.includes('/git/ref/heads/')), false);
});

test('immutable commit input fails closed when provider resolves another SHA', async () => {
  const service = serviceWith({ overrides: { [`/repos/acme/project/commits/${OTHER_REVISION}`]: { sha: REVISION } } });
  await assert.rejects(() => service.readSnapshot({ ...input, ref: { kind: 'commit', name: OTHER_REVISION } }), (error) => error.code === 'gh3-revision-mismatch');
});

test('authorized private reads use GH3.2 without exposing the installation token', async () => {
  let providerInput, observedAuthorization;
  const githubAppProvider = { async withInstallationToken(value) { providerInput = value; return value.operation('installation-secret'); } };
  const service = serviceWith({ githubAppProvider, onRequest: (_url, init) => { observedAuthorization = init.headers.Authorization; } });
  const result = await service.readSnapshot({ ...input, visibility: 'authorized-private', connectionId: 'github:7' });
  assert.equal(providerInput.capability, 'github.repository.read');
  assert.equal(providerInput.requiredProviderPermission, 'contents');
  assert.equal(observedAuthorization, 'Bearer installation-secret');
  assert.equal(result.provenance.connectionId, 'github:7');
  assert.equal(JSON.stringify(result).includes('installation-secret'), false);
});

test('missing permission and deleted refs produce explicit failures', async () => {
  for (const [status, code] of [[403, 'gh3-repository-read-permission-denied'], [404, 'gh3-repository-read-not-found']]) {
    const service = createGitHubRepositoryReadAnalysisService({ fetchImpl: async (url) => url.endsWith('/repos/acme/project') ? response({ id: 7, full_name: 'acme/project' }) : response({}, status) });
    await assert.rejects(() => service.readSnapshot(input), (error) => error.code === code && error.status === status);
  }
});

test('a missing optional requested file does not falsely report the whole repository as unavailable', async () => {
  const service = createGitHubRepositoryReadAnalysisService({
    fetchImpl: async (url) => {
      if (new URL(url).pathname.endsWith('/contents/missing.md')) return response({}, 404);
      return response(bodyFor(url));
    },
    clock: () => new Date('2026-08-20T10:00:00Z')
  });
  const result = await service.readSnapshot({ ...input, files: ['missing.md'] });
  assert.equal(result.revision, REVISION);
  assert.deepEqual(result.files, []);
  assert.deepEqual(result.missingFiles, ['missing.md']);
});

test('cross-repository response identity is rejected before facts are returned', async () => {
  const service = createGitHubRepositoryReadAnalysisService({ fetchImpl: async () => response({ id: 9, full_name: 'other/project' }) });
  await assert.rejects(() => service.readSnapshot(input), (error) => error.code === 'gh3-cross-repository-denied');
});

test('large trees and file content are bounded with explicit truncation', async () => {
  const content = 'x'.repeat(300);
  const overrides = {
    [`/repos/acme/project/git/trees/${REVISION}`]: { truncated: true, tree: [{ path: 'README.md', type: 'blob', sha: '1' }, { path: 'src/a.js', type: 'blob', sha: '2' }] },
    '/repos/acme/project/contents/README.md': { type: 'file', path: 'README.md', sha: '1', encoding: 'base64', content: Buffer.from(content).toString('base64'), size: content.length }
  };
  const result = await serviceWith({ overrides, maxTreeEntries: 1, maxFileCharacters: 100 }).readSnapshot(input);
  assert.equal(result.tree.entries.length, 1); assert.equal(result.tree.truncated, true);
  assert.equal(result.files[0].content.length, 100); assert.equal(result.files[0].truncated, true);
});

test('diff, reviews, checks, workflow jobs and artifact metadata remain revision-scoped and bounded', async () => {
  const overrides = {
    [`/repos/acme/project/compare/${OTHER_REVISION}...${REVISION}`]: { status: 'ahead', ahead_by: 1, behind_by: 0, files: [{ filename: 'src/a.js', status: 'modified', patch: 'patch' }] },
    '/repos/acme/project/pulls/12/reviews': [{ id: 1, state: 'APPROVED' }],
    '/repos/acme/project/actions/runs/99/jobs': { jobs: [{ id: 2, name: 'test', status: 'completed', conclusion: 'success' }] },
    '/repos/acme/project/actions/runs/99/artifacts': { artifacts: [{ id: 3, name: 'logs' }] },
    [`/repos/acme/project/commits/${REVISION}/check-runs`]: { check_runs: [{ id: 4, name: 'ci', status: 'completed', conclusion: 'success' }] }
  };
  const result = await serviceWith({ overrides }).readSnapshot({ ...input, compareWith: OTHER_REVISION, pullRequestNumbers: [12], workflowRunIds: [99] });
  assert.equal(result.comparison.headRevision, REVISION); assert.equal(result.comparison.files[0].path, 'src/a.js');
  assert.equal(result.collaboration.reviews[0].state, 'APPROVED'); assert.equal(result.ci.jobs[0].title, 'test'); assert.equal(result.ci.artifacts[0].title, 'logs'); assert.equal(result.ci.checks[0].conclusion, 'success');
});
