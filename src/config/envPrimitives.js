// AGENT NOTE:
// SG 2.0 environment primitive helpers.
// Purpose: provide low-level safe process.env access in one place.
// Do not add Telegram, AI, runtime status, business logic, or project policy here.

export function envStr(key, fallback = "") {
  const value = process.env[key];

  if (value === undefined || value === null) {
    return fallback;
  }

  const text = String(value);

  if (!text.trim()) {
    return fallback;
  }

  return text;
}

export function envFirst(keys = [], fallback = "") {
  for (const key of keys) {
    const value = envStr(key, "").trim();

    if (value) {
      return value;
    }
  }

  return fallback;
}

export function envInt(key, fallback) {
  const value = Number(process.env[key]);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.floor(value);
}

export function envIntRange(key, fallback, { min = -Infinity, max = Infinity } = {}) {
  const value = envInt(key, fallback);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

export function envBool(key, fallback = false) {
  const raw = process.env[key];

  if (raw === undefined || raw === null || !String(raw).trim()) {
    return Boolean(fallback);
  }

  const value = String(raw).trim().toLowerCase();

  if (["1", "true", "yes", "y", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "n", "off"].includes(value)) {
    return false;
  }

  return Boolean(fallback);
}

export function requireEnv(key) {
  const value = envStr(key, "").trim();

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}
