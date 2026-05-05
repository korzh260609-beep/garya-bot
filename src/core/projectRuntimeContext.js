// AGENT NOTE:
// SG 2.0 project runtime context.
// Purpose: expose current project coordinates to the AI layer from runtime config/env.
// This is not a permission layer and must not become a keyword router.

import { envStr } from "../config/env.js";

export function buildProjectRuntimeContext() {
  const repository = envStr("GITHUB_REPO", "korzh260609-beep/garya-bot").trim();
  const branch = envStr("GITHUB_BRANCH", "dev/v2-start").trim();

  return {
    currentProject: {
      repository,
      branch,
    },
    github: {
      gateway: "github_request",
      apiBase: "https://api.github.com",
      rootContentsPath: repository ? `/repos/${repository}/contents` : "",
    },
  };
}

export function formatProjectRuntimeContext() {
  return JSON.stringify(buildProjectRuntimeContext(), null, 2);
}
