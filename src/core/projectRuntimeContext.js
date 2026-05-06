// AGENT NOTE:
// SG 2.0 project runtime context.
// Purpose: expose current project coordinates and branch guide to the AI layer from runtime config/env.
// This is not a permission layer and must not become a keyword router.

import { envStr } from "../config/env.js";

export function buildProjectRuntimeContext() {
  const repository = envStr("GITHUB_REPO", "korzh260609-beep/garya-bot").trim();
  const primaryBranch = envStr("GITHUB_BRANCH", "dev/v2-start").trim();
  const legacyBranch = envStr("GITHUB_LEGACY_BRANCH", "main").trim();

  return {
    currentProject: {
      repository,
      primaryBranch,
      workingBranch: primaryBranch,
      legacyBranch,
      branchGuide: {
        primaryBranchMeaning: "current SG 2.0 working branch",
        legacyBranchMeaning: "old/stable branch, available for inspection but not the current working baseline",
        defaultBranchForProjectQuestions: primaryBranch,
        inspectOtherBranchesWhenRequested: true,
      },
    },
    github: {
      gateway: "github_request",
      apiBase: "https://api.github.com",
      rootContentsPath: repository ? `/repos/${repository}/contents` : "",
      canInspectProjectBranches: true,
      canInspectPublicRepositories: true,
    },
  };
}

export function formatProjectRuntimeContext() {
  return JSON.stringify(buildProjectRuntimeContext(), null, 2);
}
