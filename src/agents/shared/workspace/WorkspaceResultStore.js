// AGENT NOTE:
// SG 2.0 workspace result store skeleton.
// Purpose: keep a lightweight pointer to the latest collected workspace result for SG chat usage.
// This is an in-memory placeholder only. Do not treat it as durable memory.
// Do not write DB, call AI, read GitHub, or expose secrets here.

let latestWorkspaceResult = null;

export function setLatestWorkspaceResult(result = {}) {
  latestWorkspaceResult = {
    type: result.type || "unknown",
    fileName: result.fileName || null,
    workspacePath: result.workspacePath || null,
    collectedAt: result.collectedAt || new Date().toISOString(),
    metadata: result.metadata && typeof result.metadata === "object" ? result.metadata : {},
  };

  return latestWorkspaceResult;
}

export function getLatestWorkspaceResult() {
  return latestWorkspaceResult;
}

export function clearLatestWorkspaceResult() {
  latestWorkspaceResult = null;
  return true;
}

export default {
  setLatestWorkspaceResult,
  getLatestWorkspaceResult,
  clearLatestWorkspaceResult,
};
