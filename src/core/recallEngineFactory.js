// src/core/recallEngineFactory.js
// STAGE 8A — RecallEngine singleton factory (mirrors memoryServiceFactory pattern)

import RecallEngine from "./RecallEngine.js";

let _instance = null;

export function getRecallEngine(opts = {}) {
  if (_instance) return _instance;
  _instance = new RecallEngine(opts);
  return _instance;
}

export function _resetRecallEngineForTests() {
  _instance = null;
}

export default getRecallEngine;
