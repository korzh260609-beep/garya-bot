// src/core/config.js
// Stage 3.6 — Config/Secrets hygiene V0 (ESM)

export function envStr(name, def = "") {
  const v = process.env[name];
  if (v == null || v === "") return def;
  return String(v);
}

export function envInt(name, def) {
  const raw = process.env[name];
  if (raw == null || raw === "") return def;

  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.trunc(n);
}

export function envBool(name, def = false) {
  const raw = String(process.env[name] || "").toLowerCase();
  if (!raw) return def;
  return raw === "true" || raw === "1" || raw === "yes" || raw === "y";
}

// allowlist-only snapshot (no secrets!)
export function getPublicEnvSnapshot(keys = []) {
  const out = {};
  for (const k of keys) out[k] = envStr(k, "");
  return out;
}
