// AGENT NOTE:
// SG 2.0 root status builder.
// Purpose: build the public / response separately from HTTP route wiring.
// Do not add secrets, Telegram setup, AI calls, memory, tasks, sources, permissions, or GitHub write logic here.

import { envStr } from "../config/env.js";

export function buildRootStatus() {
  return {
    ok: true,
    project: "SG 2.0 / Советник GARYA",
    branch: envStr("RENDER_GIT_BRANCH", "unknown"),
    stage: "v0-foundation-speaking-minimal",
  };
}
