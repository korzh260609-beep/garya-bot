// src/core/handleMessage/dedupeMemory.js

import { envIntRange } from "../config.js";

const DEDUPE_TTL_MS = envIntRange("DEDUPE_TTL_MS", 5 * 60 * 1000, {
  min: 1000,
  max: 60 * 60 * 1000,
});

const DEDUPE_MAX = envIntRange("DEDUPE_MAX", 5000, {
  min: 100,
  max: 50000,
});

// key -> lastSeenTs
const __dedupeSeen = new Map();

export function dedupeSeenHasFresh(key, now) {
  if (!key) return false;
  const ts = __dedupeSeen.get(key);
  if (!ts) return false;
  return now - ts <= DEDUPE_TTL_MS;
}

export function dedupeRemember(key, now) {
  if (!key) return;
  __dedupeSeen.set(key, now);

  if (__dedupeSeen.size <= DEDUPE_MAX) return;

  const cutoff = now - DEDUPE_TTL_MS;
  for (const [k, ts] of __dedupeSeen.entries()) {
    if (ts < cutoff) __dedupeSeen.delete(k);
    if (__dedupeSeen.size <= DEDUPE_MAX) break;
  }

  while (__dedupeSeen.size > DEDUPE_MAX) {
    const oldestKey = __dedupeSeen.keys().next().value;
    __dedupeSeen.delete(oldestKey);
  }
}