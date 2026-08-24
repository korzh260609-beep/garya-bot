// SG 2.0-compatible GitHub App authentication.
// Secrets stay in the deployment environment; callers receive only a short-lived installation token.

import crypto from 'node:crypto';

let cachedToken = null;
let cachedUntil = 0;

function required(value, name) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result) throw Object.assign(new Error(`${name} is required`), { code: 'github-app-config-invalid' });
  return result;
}

function base64Url(value) {
  return Buffer.from(value).toString('base64').replace(/=/gu, '').replace(/\+/gu, '-').replace(/\//gu, '_');
}

function privateKeyFrom(env) {
  const encoded = typeof env.GITHUB_APP_PRIVATE_KEY_BASE64 === 'string' ? env.GITHUB_APP_PRIVATE_KEY_BASE64.trim() : '';
  if (encoded) return Buffer.from(encoded, 'base64').toString('utf8').trim();
  return required(env.GITHUB_APP_PRIVATE_KEY, 'GITHUB_APP_PRIVATE_KEY')
    .replace(/^["']|["']$/gu, '')
    .replace(/\\n/gu, '\n')
    .trim();
}

function createAppJwt(env, now) {
  const issuedAt = Math.floor(now.getTime() / 1000) - 60;
  const body = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(JSON.stringify({ iat: issuedAt, exp: issuedAt + 540, iss: required(env.GITHUB_APP_ID, 'GITHUB_APP_ID') }))}`;
  const signature = crypto.createSign('RSA-SHA256').update(body).end().sign(privateKeyFrom(env));
  return `${body}.${base64Url(signature)}`;
}

export function isGitHubAppConfigured(env = process.env) {
  return Boolean(env.GITHUB_APP_ID && env.GITHUB_APP_INSTALLATION_ID && (env.GITHUB_APP_PRIVATE_KEY || env.GITHUB_APP_PRIVATE_KEY_BASE64));
}

export async function getGitHubAppAccess({ env = process.env, fetchImpl = globalThis.fetch, clock = () => new Date() } = {}) {
  if (cachedToken && clock().getTime() < cachedUntil - 60_000) return cachedToken;
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');

  const installationId = required(env.GITHUB_APP_INSTALLATION_ID, 'GITHUB_APP_INSTALLATION_ID');
  const response = await fetchImpl(`https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${createAppJwt(env, clock())}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sg2-github-app'
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.token) throw Object.assign(new Error(data?.message || `GitHub App auth failed: ${response.status}`), { code: 'github-app-auth-failed', retryable: response.status >= 500 });

  cachedToken = data.token;
  cachedUntil = data.expires_at ? new Date(data.expires_at).getTime() : clock().getTime() + 50 * 60_000;
  return cachedToken;
}

export function resetGitHubAppAccessCacheForTests() {
  cachedToken = null;
  cachedUntil = 0;
}
