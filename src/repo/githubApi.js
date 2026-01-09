// ============================================================================
// === src/repo/githubApi.js — GitHub REST helper (SKELETON)
// ============================================================================

function buildHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "sg-repo-indexer",
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function githubGetJson(url, { token } = {}) {
  const res = await fetch(url, {
    method: "GET",
    headers: buildHeaders(token),
  });

  const text = await res.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // keep json as null
  }

  if (!res.ok) {
    const msg =
      (json && (json.message || json.error)) ||
      text ||
      `HTTP ${res.status}`;
    throw new Error(`GitHub API error: ${msg}`);
  }

  return json;
}

