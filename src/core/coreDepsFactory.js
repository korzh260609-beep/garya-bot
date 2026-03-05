// src/core/coreDepsFactory.js
// Stage 7A — ProjectMemory wiring (SAFE: no missing modules)

import { getProjectSection, upsertProjectSection } from "../../projectMemory.js";

/**
 * Core dependencies factory
 * We expose getProjectSection/upsertProjectSection directly,
 * because commandDispatcher expects ctx.getProjectSection / ctx.upsertProjectSection.
 */
export function createCoreDeps({ pool, bot } = {}) {
  return {
    pool,
    bot,

    // ✅ Stage 7A — Project Memory functions
    getProjectSection,
    upsertProjectSection,
  };
}

export default createCoreDeps;