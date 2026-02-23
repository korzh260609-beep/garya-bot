// src/core/alreadySeenFactory.js
// STAGE 8B — AlreadySeenDetector factory (singleton)

import AlreadySeenDetector from "./AlreadySeenDetector.js";

let _instance = null;

export function getAlreadySeenDetector(opts = {}) {
  if (_instance) return _instance;
  _instance = new AlreadySeenDetector(opts);
  return _instance;
}

export function _resetAlreadySeenDetectorForTests() {
  _instance = null;
}

export default getAlreadySeenDetector;
