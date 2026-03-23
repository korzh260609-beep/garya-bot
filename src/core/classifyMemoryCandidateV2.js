// src/core/classifyMemoryCandidateV2.js
// MEMORY CLASSIFIER V2 — SINGLE ENTRYPOINT SKELETON
//
// Goal:
// - one import point for future runtime wiring
// - keep caller code simple
// - no side effects

import MemoryClassifierV2 from "./MemoryClassifierV2.js";

let _instance = null;

export function getMemoryClassifierV2() {
  if (_instance) return _instance;
  _instance = new MemoryClassifierV2();
  return _instance;
}

export function classifyMemoryCandidateV2({ text } = {}) {
  const classifier = getMemoryClassifierV2();
  return classifier.classify({ text });
}

export function _resetMemoryClassifierV2ForTests() {
  _instance = null;
}

export default classifyMemoryCandidateV2;