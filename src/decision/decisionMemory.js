/**
 * Decision Memory
 *
 * Responsibility:
 * - stores sandbox decision execution snapshots
 * - provides isolated in-memory history
 * - does NOT use DB
 * - does NOT affect production pipeline
 *
 * IMPORTANT:
 * - sandbox only
 * - volatile memory only
 * - no external side effects
 */

const DECISION_MEMORY_LIMIT = 50;

const decisionMemoryStore = [];

function createMemoryRecord(result = {}) {
  return {
    savedAt: Date.now(),
    context: result?.context || null,
    route: result?.route || null,
    workerResult: result?.workerResult || null,
    judgeResult: result?.judgeResult || null,
    trace: result?.trace || null,
    warnings: result?.warnings || [],
    finalText: result?.finalText || null,
    ok: result?.ok || false,
  };
}

function trimDecisionMemory() {
  while (decisionMemoryStore.length > DECISION_MEMORY_LIMIT) {
    decisionMemoryStore.shift();
  }
}

export function saveDecisionMemory(result = {}) {
  const record = createMemoryRecord(result);

  decisionMemoryStore.push(record);
  trimDecisionMemory();

  return record;
}

export function getDecisionMemory() {
  return [...decisionMemoryStore];
}

export function getRecentDecisionMemory(limit = 10) {
  const normalizedLimit =
    typeof limit === "number" && limit > 0
      ? Math.min(Math.floor(limit), DECISION_MEMORY_LIMIT)
      : 10;

  return decisionMemoryStore.slice(-normalizedLimit);
}

export function getDecisionMemorySize() {
  return decisionMemoryStore.length;
}

export function getDecisionMemoryLimit() {
  return DECISION_MEMORY_LIMIT;
}

export function clearDecisionMemory() {
  decisionMemoryStore.length = 0;

  return {
    ok: true,
    cleared: true,
    size: 0,
  };
}