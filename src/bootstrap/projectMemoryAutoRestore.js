// src/bootstrap/projectMemoryAutoRestore.js
// ============================================================================
// STAGE 7A.4 — project auto-restore / source sync
// Policy:
// - seed canonical project docs into project_memory if missing
// - do not overwrite existing DB content unless explicitly requested
// - keep logic universal and transport-agnostic
// ============================================================================

import { syncProjectMemorySources } from "../../projectMemory.js";

export async function autoRestoreProjectMemory({
  enabled = true,
  overwrite = false,
} = {}) {
  if (!enabled) {
    return { ok: true, skipped: true, reason: "disabled" };
  }

  return syncProjectMemorySources({
    overwrite,
  });
}

export default autoRestoreProjectMemory;