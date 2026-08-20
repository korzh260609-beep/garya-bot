import { createGitHubRepositoryIdentity } from './githubDevelopmentContract.js';

export const GITHUB_DISCOVERY_KINDS = Object.freeze(['repository', 'code', 'commit', 'issue', 'pull-request', 'user', 'release', 'documentation']);
export const GITHUB_DISCOVERY_VISIBILITY = Object.freeze(['public', 'authorized-private']);

function fail(code, message, retryable = false) { const error = new Error(message); error.name = 'GitHubDiscoveryError'; error.code = code; error.retryable = retryable; throw error; }
function required(value, field) { if (typeof value !== 'string' || value.trim() === '') fail('gh3-discovery-input-invalid', `${field} is required`); return value.trim(); }
function bounded(value, field, fallback, min, max) { const number = value ?? fallback; if (!Number.isInteger(number) || number < min || number > max) fail('gh3-discovery-input-invalid', `${field} must be from ${min} to ${max}`); return number; }
function header(response, name) { return response?.headers?.get?.(name) ?? null; }
function text(value, max = 500) { return typeof value === 'string' ? value.slice(0, max) : null; }
function timestamp(value) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null; }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const nested of Object.values(value)) freeze(nested); return Object.freeze(value); }

function endpoint({ kind, query, repository, page, perPage }) {
  const q = encodeURIComponent(query);
  const paging = `per_page=${perPage}&page=${page}`;
  if (kind === 'repository') return `/search/repositories?q=${q}&${paging}`;
  if (kind === 'code') return `/search/code?q=${q}&${paging}`;
  if (kind === 'commit') return `/search/commits?q=${q}&${paging}`;
  if (kind === 'user') return `/search/users?q=${q}&${paging}`;
  if (kind === 'issue') return `/search/issues?q=${encodeURIComponent(`${query} is:issue`)}&${paging}`;
  if (kind === 'pull-request') return `/search/issues?q=${encodeURIComponent(`${query} is:pr`)}&${paging}`;
  if (kind === 'documentation') return `/search/code?q=${encodeURIComponent(`${query} extension:md`)}&${paging}`;
  if (kind === 'release') {
    if (!repository) fail('gh3-discovery-repository-required', 'repository is required for release discovery');
    return `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/releases?${paging}`;
  }
  fail('gh3-discovery-kind-unsupported', `unsupported discovery kind: ${kind}`);
}

function normalize(item, { kind, observedAt, visibility }) {
  const repository = item.repository?.full_name ?? item.full_name ?? null;
  const license = item.license ? { key: item.license.key ?? null, name: item.license.name ?? null, spdxId: item.license.spdx_id ?? null } : null;
  return freeze({
    sourceClass: visibility === 'public' ? 'github-public' : 'github-authorized-private',
    untrustedExternalData: true,
    kind,
    providerId: item.id == null ? (item.node_id ?? null) : String(item.id),
    canonicalUrl: item.html_url ?? item.url ?? null,
    title: text(item.full_name ?? item.name ?? item.login ?? item.title ?? item.tag_name ?? item.path ?? item.sha, 300),
    summary: text(item.description ?? item.body ?? item.commit?.message, 800),
    repository,
    revision: item.sha ?? item.commit?.tree?.sha ?? item.target_commitish ?? null,
    updatedAt: timestamp(item.updated_at ?? item.commit?.committer?.date ?? item.published_at),
    license: license ? freeze(license) : null,
    observedAt
  });
}

export function createGlobalGitHubDiscoveryService({ fetchImpl = globalThis.fetch, githubAppProvider = null, apiBaseUrl = 'https://api.github.com', clock = () => new Date() } = {}) {
  if (typeof fetchImpl !== 'function' || typeof clock !== 'function') throw new TypeError('invalid discovery dependency');
  const base = required(apiBaseUrl, 'apiBaseUrl').replace(/\/+$/u, '');

  async function execute({ kind, query, visibility, repository, connectionId, maxResults, maxPages, perPage }, token = null) {
    const observedAt = clock().toISOString();
    const results = [];
    let totalCount = null, incomplete = false, pagesRead = 0, rateLimit = null;
    for (let page = 1; page <= maxPages && results.length < maxResults; page += 1) {
      const url = `${base}${endpoint({ kind, query, repository, page, perPage })}`;
      let response;
      try {
        response = await fetchImpl(url, { method: 'GET', headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'sg-gh3-discovery', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      } catch { fail('gh3-discovery-provider-unavailable', 'GitHub discovery request failed', true); }
      rateLimit = freeze({ remaining: header(response, 'x-ratelimit-remaining'), limit: header(response, 'x-ratelimit-limit'), resetAtEpoch: header(response, 'x-ratelimit-reset') });
      if (response?.status === 403 || response?.status === 429) fail('gh3-discovery-rate-limited', 'GitHub discovery rate limit reached', true);
      if (!response?.ok) fail(`gh3-discovery-http-${response?.status ?? 'unknown'}`, 'GitHub discovery request was not successful', response?.status >= 500);
      let body; try { body = await response.json(); } catch { fail('gh3-discovery-response-invalid', 'GitHub discovery returned invalid JSON'); }
      const items = Array.isArray(body) ? body : (Array.isArray(body.items) ? body.items : []);
      if (totalCount === null) totalCount = Array.isArray(body) ? items.length : (Number.isInteger(body.total_count) ? body.total_count : null);
      incomplete ||= body.incomplete_results === true;
      pagesRead = page;
      results.push(...items.slice(0, maxResults - results.length).map((item) => normalize(item, { kind, observedAt, visibility })));
      if (items.length < perPage) break;
    }
    return freeze({ kind, query, visibility, repository: repository?.fullName ?? null, results, totalCount, pagesRead, truncated: incomplete || results.length >= maxResults || (totalCount !== null && totalCount > results.length), incomplete, rateLimit, observedAt, provenance: { provider: 'github', apiBaseUrl: base, connectionId: visibility === 'authorized-private' ? connectionId : null }, qualification: { readOnly: true, projectTruth: false, licenseReviewRequiredBeforeReuse: kind === 'code' || kind === 'documentation' } });
  }

  async function search(input = {}) {
    const kind = required(input.kind, 'kind');
    if (!GITHUB_DISCOVERY_KINDS.includes(kind)) fail('gh3-discovery-kind-unsupported', `unsupported discovery kind: ${kind}`);
    const query = required(input.query, 'query');
    if (query.length > 500) fail('gh3-discovery-input-invalid', 'query is too long');
    const visibility = input.visibility ?? 'public';
    if (!GITHUB_DISCOVERY_VISIBILITY.includes(visibility)) fail('gh3-discovery-input-invalid', 'visibility is invalid');
    const repository = input.repository ? createGitHubRepositoryIdentity(input.repository) : null;
    const options = { kind, query, visibility, repository, connectionId: input.connectionId ?? null, maxResults: bounded(input.maxResults, 'maxResults', 30, 1, 100), maxPages: bounded(input.maxPages, 'maxPages', 2, 1, 5), perPage: bounded(input.perPage, 'perPage', 30, 1, 100) };
    if (visibility === 'public') return execute(options);
    if (!githubAppProvider?.withInstallationToken) fail('gh3-private-discovery-unavailable', 'authorized private discovery requires GitHub App connection');
    return githubAppProvider.withInstallationToken({ connectionId: required(input.connectionId, 'connectionId'), capability: kind === 'code' || kind === 'documentation' ? 'github.code.search' : 'github.repository.read', repository, operation: (token) => execute(options, token) });
  }
  return Object.freeze({ search });
}
