import { createMemory2Record } from './memory2.js';

function clone(record) { return createMemory2Record(JSON.parse(JSON.stringify(record))); }

export function createInMemoryMemory2Store({ maxRecords = 5000 } = {}) {
  if (!Number.isInteger(maxRecords) || maxRecords < 1) throw new TypeError('maxRecords must be positive integer');
  const records = new Map();
  return Object.freeze({
    async insert(raw) {
      const record = createMemory2Record(raw);
      if (records.has(record.id)) throw new Error('memory id already exists');
      const duplicate = [...records.values()].find((item) => item.semanticFingerprint === record.semanticFingerprint && ['active','temporary'].includes(item.lifecycleState));
      if (duplicate) return clone(duplicate);
      records.set(record.id, record);
      while (records.size > maxRecords) records.delete(records.keys().next().value);
      return clone(record);
    },
    async get(memoryId) { const record = records.get(String(memoryId)) ?? null; return record ? clone(record) : null; },
    async update(memoryId, patch = {}) {
      const existing = records.get(String(memoryId));
      if (!existing) return null;
      const updated = createMemory2Record({ ...existing, ...patch, memoryScope: existing.memoryScope, provenance: patch.provenance ?? existing.provenance, metadata: patch.metadata ?? existing.metadata });
      records.set(updated.id, updated);
      return clone(updated);
    },
    async list({ projectScope = null, groupScope = undefined, threadScope = undefined, ownerGlobalUserId = undefined, includeHistory = false, limit = 500 } = {}) {
      let result = [...records.values()];
      if (projectScope != null) result = result.filter((item) => item.memoryScope.projectScope === projectScope);
      if (groupScope !== undefined) result = result.filter((item) => (item.memoryScope.groupScope ?? null) === (groupScope ?? null));
      if (threadScope !== undefined) result = result.filter((item) => (item.memoryScope.threadScope ?? null) === (threadScope ?? null));
      if (ownerGlobalUserId !== undefined) result = result.filter((item) => item.memoryScope.ownerGlobalUserId == null || item.memoryScope.ownerGlobalUserId === (ownerGlobalUserId ?? null));
      if (!includeHistory) result = result.filter((item) => ['active','temporary'].includes(item.lifecycleState));
      result.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
      return result.slice(0, Math.max(1, Math.min(5000, Number(limit) || 500))).map(clone);
    },
    async listAll() { return [...records.values()].map(clone); }
  });
}
