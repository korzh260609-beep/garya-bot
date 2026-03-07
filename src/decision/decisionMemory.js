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

export function saveDecisionMemory(result = {}) {
  const record = createMemoryRecord(result);

  decisionMemoryStore.push(record);

  return record;
}

export function getDecisionMemory() {
  return [...decisionMemoryStore];
}

export function getDecisionMemorySize() {
  return decisionMemoryStore.length;
}

export function clearDecisionMemory() {
  decisionMemoryStore.length = 0;

  return {
    ok: true,
    cleared: true,
    size: 0,
  };
}