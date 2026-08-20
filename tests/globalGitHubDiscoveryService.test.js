import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlobalGitHubDiscoveryService } from '../src/githubDevelopment/globalGitHubDiscoveryService.js';

function response(body, { status = 200, remaining = '49' } = {}) { return { ok: status >= 200 && status < 300, status, headers: { get(name) { return name === 'x-ratelimit-remaining' ? remaining : (name === 'x-ratelimit-limit' ? '60' : null); } }, async json() { return body; } }; }

test('public repository discovery is bounded, qualified and provenance-rich', async () => {
  const service = createGlobalGitHubDiscoveryService({ fetchImpl: async (url, init) => { assert.equal('Authorization' in init.headers, false); assert.match(url, /search\/repositories/); return response({ total_count: 1, incomplete_results: false, items: [{ id: 1, full_name: 'owner/repo', html_url: 'https://github.com/owner/repo', description: 'Example', updated_at: '2026-08-19T00:00:00Z', license: { key: 'mit', name: 'MIT', spdx_id: 'MIT' } }] }); }, clock: () => new Date('2026-08-20T10:00:00Z') });
  const result = await service.search({ kind: 'repository', query: 'semantic memory' });
  assert.equal(result.results[0].repository, 'owner/repo'); assert.equal(result.results[0].untrustedExternalData, true); assert.equal(result.results[0].license.spdxId, 'MIT'); assert.equal(result.qualification.projectTruth, false); assert.equal(result.rateLimit.remaining, '49');
});

test('pagination and result count are bounded and truncation is explicit', async () => {
  let calls = 0; const service = createGlobalGitHubDiscoveryService({ fetchImpl: async () => { calls += 1; return response({ total_count: 200, incomplete_results: false, items: Array.from({ length: 3 }, (_, index) => ({ id: `${calls}-${index}`, full_name: `o/r${index}` })) }); } });
  const result = await service.search({ kind: 'repository', query: 'x', perPage: 3, maxPages: 2, maxResults: 5 });
  assert.equal(calls, 2); assert.equal(result.results.length, 5); assert.equal(result.truncated, true);
});

test('issue and pull request searches add deterministic type qualification', async () => {
  const urls = []; const service = createGlobalGitHubDiscoveryService({ fetchImpl: async (url) => { urls.push(decodeURIComponent(url)); return response({ items: [] }); } });
  await service.search({ kind: 'issue', query: 'memory bug' }); await service.search({ kind: 'pull-request', query: 'memory bug' });
  assert.match(urls[0], /is:issue/); assert.match(urls[1], /is:pr/);
});

test('authorized private discovery must pass through GH3.2 connection provider', async () => {
  let providerInput, authHeader; const githubAppProvider = { async withInstallationToken(input) { providerInput = input; return input.operation('private-token'); } };
  const service = createGlobalGitHubDiscoveryService({ githubAppProvider, fetchImpl: async (_url, init) => { authHeader = init.headers.Authorization; return response({ items: [] }); } });
  const result = await service.search({ kind: 'code', query: 'class Planner', visibility: 'authorized-private', connectionId: 'github:7', repository: { owner: 'owner', name: 'private' } });
  assert.equal(providerInput.capability, 'github.code.search'); assert.equal(authHeader, 'Bearer private-token'); assert.equal(result.provenance.connectionId, 'github:7'); assert.equal(JSON.stringify(result).includes('private-token'), false);
});

test('private discovery without connection fails closed before network', async () => {
  let calls = 0; const service = createGlobalGitHubDiscoveryService({ fetchImpl: async () => { calls += 1; } });
  await assert.rejects(() => service.search({ kind: 'code', query: 'x', visibility: 'authorized-private', connectionId: 'x' }), (error) => error.code === 'gh3-private-discovery-unavailable'); assert.equal(calls, 0);
});

test('rate limits and incomplete results remain visible', async () => {
  const limited = createGlobalGitHubDiscoveryService({ fetchImpl: async () => response({}, { status: 429, remaining: '0' }) });
  await assert.rejects(() => limited.search({ kind: 'user', query: 'alice' }), (error) => error.code === 'gh3-discovery-rate-limited' && error.retryable === true);
  const partial = createGlobalGitHubDiscoveryService({ fetchImpl: async () => response({ total_count: 10, incomplete_results: true, items: [] }) });
  assert.equal((await partial.search({ kind: 'commit', query: 'fix' })).incomplete, true);
});

test('release discovery requires explicit repository and documentation is license-qualified', async () => {
  const service = createGlobalGitHubDiscoveryService({ fetchImpl: async () => response([]) });
  await assert.rejects(() => service.search({ kind: 'release', query: 'v2' }), (error) => error.code === 'gh3-discovery-repository-required');
  const docs = await service.search({ kind: 'documentation', query: 'setup' }); assert.equal(docs.qualification.licenseReviewRequiredBeforeReuse, true);
});
