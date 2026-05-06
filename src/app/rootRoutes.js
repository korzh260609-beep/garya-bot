// AGENT NOTE:
// SG 2.0 root HTTP route module.
// Purpose: keep public root status response separate from server startup.
// Do not add Telegram, AI, memory, tasks, sources, permissions, or GitHub write logic here.

import { envStr } from "../config/env.js";

export function buildRootStatus() {
  return {
    ok: true,
    project: "SG 2.0 / Советник GARYA",
    branch: envStr("RENDER_GIT_BRANCH", "unknown"),
    stage: "v0-foundation-speaking-minimal",
  };
}

export function attachRootRoutes(app) {
  app.get("/", (req, res) => {
    res.status(200).json(buildRootStatus());
  });

  return app;
}
