// AGENT NOTE:
// SG 2.0 GitHub request utility helpers.
// Purpose: keep pure request parsing/normalization helpers outside the GitHub tool wrapper.
// Do not add auth, approval state, behavior policy, or network calls here.

export function jsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ ok: false, error: "Failed to stringify GitHub tool result." });
  }
}

export function parseJsonObject(value, fallback = {}) {
  if (!value) return fallback;

  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeMethod(method) {
  return String(method || "GET").trim().toUpperCase();
}

export function normalizePath(path) {
  const raw = String(path || "").trim();
  if (!raw) return "";

  if (raw.startsWith("https://api.github.com/")) {
    return raw.slice("https://api.github.com".length);
  }

  if (raw.startsWith("api.github.com/")) {
    return raw.slice("api.github.com".length);
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function isWriteMethod(method) {
  return !["GET", "HEAD"].includes(normalizeMethod(method));
}

export function appendQuery(url, query = {}) {
  if (!query || typeof query !== "object" || Array.isArray(query)) return url;

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) params.append(key, String(item));
      }
      continue;
    }

    params.set(key, String(value));
  }

  const qs = params.toString();
  if (!qs) return url;

  return url.includes("?") ? `${url}&${qs}` : `${url}?${qs}`;
}

export async function readResponse(response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
