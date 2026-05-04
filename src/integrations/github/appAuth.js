// AGENT NOTE:
// SG 2.0 GitHub App runtime auth.
// Purpose: create short-lived GitHub installation access for SG runtime.
// Secret env values must stay only in Render.

import crypto from "crypto";
import { requireEnv } from "../../config/env.js";

let cached = null;
let cachedUntil = 0;

function b64url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function normalizePem(value) {
  return String(value || "").replace(/\\n/g, "\n").trim();
}

function appJwt() {
  const appId = requireEnv("GITHUB_APP_ID");
  const pem = normalizePem(requireEnv("GITHUB_APP_PRIVATE_KEY"));
  const iat = Math.floor(Date.now() / 1000) - 60;
  const exp = iat + 540;
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iat, exp, iss: appId }));
  const body = `${header}.${payload}`;
  const sig = crypto.createSign("RSA-SHA256").update(body).end().sign(pem);
  return `${body}.${b64url(sig)}`;
}

export async function getGitHubAppAccess() {
  if (cached && Date.now() < cachedUntil - 60_000) return cached;

  const installationId = requireEnv("GITHUB_APP_INSTALLATION_ID");
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${appJwt()}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "sg2-github-app",
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.token) {
    throw new Error(data?.message || `GitHub App auth failed: ${response.status}`);
  }

  cached = data.token;
  cachedUntil = data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 50 * 60_000;
  return cached;
}
