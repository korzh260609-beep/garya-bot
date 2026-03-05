// src/core/coreDepsFactory.js

import { createProjectMemoryService } from "../services/projectMemory/projectMemoryService.js";

/**
 * Core dependencies factory
 * Stage 7A — ProjectMemory wiring
 */
export function createCoreDeps({ pool, bot }) {

  // Project Memory Service
  const pm = createProjectMemoryService({ pool });

  return {
    pool,
    bot,
    pm
  };
}