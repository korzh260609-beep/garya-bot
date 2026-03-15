// src/core/fetchWithTimeout.js
// Unified fetch wrapper with timeout protection.
// Goal: prevent hanging external requests on Render / external APIs.

function buildTimeoutError(url, timeoutMs, method = "GET") {
  const safeUrl = String(url || "").slice(0, 300);
  return new Error(
    `Fetch timeout after ${timeoutMs} ms (${String(method || "GET").toUpperCase()} ${safeUrl})`
  );
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const method = options?.method || "GET";

  const timer = setTimeout(() => {
    try {
      controller.abort();
    } catch (_) {
      // ignore
    }
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw buildTimeoutError(url, timeoutMs, method);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}