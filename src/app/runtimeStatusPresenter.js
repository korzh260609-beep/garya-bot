// AGENT NOTE:
// SG 2.0 runtime status presenter.
// Purpose: prepare safe public runtime diagnostics for app-level status responses.
// Do not add secrets, transport setup, AI calls, memory, tasks, sources, permissions, or GitHub write logic here.

import { getPublicRuntimeStatus } from "../config/env.js";

export function buildRuntimeStatusBlock() {
  return getPublicRuntimeStatus();
}
