// src/core/memoryServiceFactory.js
// STAGE 7 — MEMORY LAYER V1
// Single entry-point to obtain MemoryService instance (no wiring changes here).
// Goal: stop spawning MemoryService ad-hoc across handlers; prepare safe refactors.

import MemoryService from "./MemoryService.js";

let _instance = null;

/**
 * Get singleton MemoryService instance.
 * @param {object} [opts]
 * @param {object} [opts.logger]
 * @param {object} [opts.db]
 * @param {object} [opts.config]
 */
export function getMemoryService(opts = {}) {
  if (_instance) return _instance;
  _instance = new MemoryService(opts);
  return _instance;
}

/**
 * For tests / controlled resets only.
 */
export function _resetMemoryServiceForTests() {
  _instance = null;
}

export default getMemoryService;
