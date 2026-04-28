// src/agentWorkspace/AgentWorkspaceRuntimeGuard.js
// ============================================================================
// AgentWorkspace Runtime Guard
// Helpers for runtime commit checks and command execution safety gates.
// ============================================================================

import { normalizeString } from "./AgentWorkspacePayloadParser.js";

export function normalizeCommitSha(value) {
  return normalizeString(value).toLowerCase();
}

export function getRuntimeCommitSha() {
  return normalizeCommitSha(
    process.env.RENDER_GIT_COMMIT ||
    process.env.RENDER_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT ||
    process.env.COMMIT_SHA ||
    process.env.SOURCE_VERSION ||
    ""
  );
}

export async function isCommitSatisfied({ runtimeCommit, requiredCommit, client }) {
  const runtime = normalizeCommitSha(runtimeCommit);
  const required = normalizeCommitSha(requiredCommit);

  if (!required) return true;
  if (!runtime) return false;
  if (runtime === required || runtime.startsWith(required) || required.startsWith(runtime)) return true;

  if (!client || typeof client.compareCommits !== "function") return false;

  try {
    const compare = await client.compareCommits(required, runtime);

    return compare?.ok === true && (
      compare.status === "identical" ||
      compare.status === "ahead"
    );
  } catch (error) {
    console.error("AgentWorkspace commit ancestry check failed:", error?.message || error);
    return false;
  }
}

export default {
  normalizeCommitSha,
  getRuntimeCommitSha,
  isCommitSatisfied,
};
