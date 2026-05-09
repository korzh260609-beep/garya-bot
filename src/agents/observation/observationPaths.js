// AGENT NOTE:
// SG Observation report path helpers.
// Purpose: keep observation report paths narrow and deterministic.
// Do not add transport logic, AI calls, memory writes, or provider-specific code here.

const OBSERVATION_RUNTIME_ROOT = "runtime/observation";

function normalizeSegment(value, fallback = "unknown") {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  const cleaned = text.replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

export function buildObservationLatestPath(name = "latest") {
  return `${OBSERVATION_RUNTIME_ROOT}/latest/${normalizeSegment(name)}.json`;
}

export function buildObservationArchivePath({ date, name } = {}) {
  const day = normalizeSegment(date || new Date().toISOString().slice(0, 10));
  return `${OBSERVATION_RUNTIME_ROOT}/archive/${day}/${normalizeSegment(name || "events")}.jsonl`;
}

export function isObservationRuntimePath(path) {
  return typeof path === "string" && path.startsWith(`${OBSERVATION_RUNTIME_ROOT}/`);
}

export function getObservationRuntimeRoot() {
  return OBSERVATION_RUNTIME_ROOT;
}
