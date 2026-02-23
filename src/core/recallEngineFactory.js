// src/core/recallEngineFactory.js
// STAGE 8A — RecallEngine singleton factory (mirrors memoryServiceFactory pattern)
//
// FIX: singleton hydration
// If instance already exists, but opts provide missing deps (db/logger/config) — apply them.
// This prevents a "db=null forever" bug when first call was made without opts.

import RecallEngine from "./RecallEngine.js";

let _instance = null;

function applyOpts(instance, opts = {}) {
  if (!instance || !opts) return;

  // hydrate db/logger/config only if missing or explicitly provided
  if (opts.db && !instance.db) instance.db = opts.db;
  if (opts.logger && instance.logger === console) instance.logger = opts.logger;

  if (opts.config && typeof opts.config === "object") {
    instance.config = { ...(instance.config || {}), ...opts.config };
  }
}

export function getRecallEngine(opts = {}) {
  if (_instance) {
    applyOpts(_instance, opts);
    return _instance;
  }
  _instance = new RecallEngine(opts);
  return _instance;
}

export function _resetRecallEngineForTests() {
  _instance = null;
}

export default getRecallEngine;
