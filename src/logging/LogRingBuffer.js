// ============================================================================
// src/logging/LogRingBuffer.js
// STAGE SKELETON — fixed-size in-memory buffers for logs/diagnosis
// Purpose:
// - keep only fresh items
// - avoid infinite growth
// - support error/deploy/diagnosis windows
// ============================================================================

function clampPositiveInt(value, def) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.floor(n);
}

function cloneSafe(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

export class FixedRingBuffer {
  constructor(limit = 100) {
    this.limit = clampPositiveInt(limit, 100);
    this.items = [];
  }

  push(item) {
    this.items.push(cloneSafe(item));

    while (this.items.length > this.limit) {
      this.items.shift();
    }

    return this.size();
  }

  clear() {
    this.items = [];
    return 0;
  }

  size() {
    return this.items.length;
  }

  getAll() {
    return this.items.map((x) => cloneSafe(x));
  }

  getLatest(count = this.limit) {
    const n = clampPositiveInt(count, this.limit);
    return this.items.slice(-n).map((x) => cloneSafe(x));
  }

  getLatestFirst(count = this.limit) {
    return this.getLatest(count).reverse();
  }
}

export class LogRingBuffer {
  constructor({
    errorLimit = 100,
    deployLimit = 10,
    diagnosisLimit = 30,
  } = {}) {
    this.errorBuffer = new FixedRingBuffer(errorLimit);
    this.deployBuffer = new FixedRingBuffer(deployLimit);
    this.diagnosisBuffer = new FixedRingBuffer(diagnosisLimit);
  }

  pushError(entry) {
    return this.errorBuffer.push(entry);
  }

  pushDeploy(entry) {
    return this.deployBuffer.push(entry);
  }

  pushDiagnosis(entry) {
    return this.diagnosisBuffer.push(entry);
  }

  getLatestErrors(count = 100) {
    return this.errorBuffer.getLatestFirst(count);
  }

  getLatestDeploys(count = 10) {
    return this.deployBuffer.getLatestFirst(count);
  }

  getLatestDiagnoses(count = 30) {
    return this.diagnosisBuffer.getLatestFirst(count);
  }

  clearErrors() {
    return this.errorBuffer.clear();
  }

  clearDeploys() {
    return this.deployBuffer.clear();
  }

  clearDiagnoses() {
    return this.diagnosisBuffer.clear();
  }

  getSnapshot() {
    return {
      errorCount: this.errorBuffer.size(),
      deployCount: this.deployBuffer.size(),
      diagnosisCount: this.diagnosisBuffer.size(),
      latestErrors: this.getLatestErrors(),
      latestDeploys: this.getLatestDeploys(),
      latestDiagnoses: this.getLatestDiagnoses(),
    };
  }
}

export default LogRingBuffer;