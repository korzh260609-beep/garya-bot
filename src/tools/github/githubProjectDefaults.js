// AGENT NOTE:
// SG 2.0 GitHub current-project defaults.
// Purpose: centralize default repository/branch behavior for the SG project GitHub gateway.
// Do not add approval state, GitHub API calls, behavior policy, or Telegram formatting here.

import { envStr } from "../../config/env.js";
import { isWriteMethod } from "./githubRequestUtils.js";

export function getCurrentProjectRepository() {
  return envStr("GITHUB_REPO", "korzh260609-beep/garya-bot").trim();
}

export function getCurrentProjectBranch() {
  return envStr("GITHUB_BRANCH", "dev/v2-start").trim();
}

export function applyCurrentProjectDefaults({ method, path, query }) {
  const repository = getCurrentProjectRepository();
  const branch = getCurrentProjectBranch();

  if (!repository || !branch) return query;
  if (method !== "GET") return query;
  if (query?.ref) return query;

  const contentsPath = `/repos/${repository}/contents`;

  if (path === contentsPath || path.startsWith(`${contentsPath}/`)) {
    return {
      ...query,
      ref: branch,
    };
  }

  return query;
}

export function applyCurrentProjectWriteDefaults({ method, path, body }) {
  const repository = getCurrentProjectRepository();
  const branch = getCurrentProjectBranch();

  if (!repository || !branch) return body;
  if (!isWriteMethod(method)) return body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  if (body.branch) return body;

  const contentsPath = `/repos/${repository}/contents/`;

  if (path.startsWith(contentsPath)) {
    return {
      ...body,
      branch,
    };
  }

  return body;
}
