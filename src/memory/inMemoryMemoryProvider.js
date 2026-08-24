import { randomUUID } from 'node:crypto';
import { createMemoryRecord, createMemoryWriteRequest } from '../contracts/memory.js';

function stableValue(value) {
  return JSON.stringify(value, Object.keys(value && typeof value === 'object' && !Array.isArray(value) ? value : {}).sort());
}

function sameScope(a, b) {
  return a.userScope === b.userScope
    && a.projectScope === b.projectScope
    && a.groupScope === b.groupScope
    && a.threadScope === b.threadScope;
}

function cloneRecord(record) {
  return createMemoryRecord({
    ...record,
    scope: { ...record.scope },
    provenance: { ...record.provenance },
    tags: [...record.tags]
  });
}

export function createInMemoryMemoryProvider({ clock = () => new Date(), maxRecords = 1000 } = {}) {
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');
  if (!Number.isInteger(maxRecords) || maxRecords < 1) throw new TypeError('maxRecords must be a positive integer');
  const records = [];

  return Object.freeze({
    name: 'in-memory-memory-provider',

    async write(rawRequest) {
      const request = createMemoryWriteRequest(rawRequest);
      const matching = records.filter((record) => record.layer === request.layer
        && record.key === request.key
        && sameScope(record.scope, request.scope));
      const duplicate = matching.find((record) => stableValue(record.value) === stableValue(request.value));
      if (duplicate) {
        return Object.freeze({ status: 'duplicate', record: cloneRecord(duplicate), conflictIds: Object.freeze([]) });
      }

      const conflicts = matching.filter((record) => stableValue(record.value) !== stableValue(request.value));
      const now = clock().toISOString();
      const record = createMemoryRecord({
        id: randomUUID(),
        ...request,
        createdAt: now,
        updatedAt: now
      });
      records.push(record);
      while (records.length > maxRecords) records.shift();

      return Object.freeze({
        status: conflicts.length > 0 ? 'conflict' : 'written',
        record: cloneRecord(record),
        conflictIds: Object.freeze(conflicts.map((item) => item.id))
      });
    },

    async listAll() {
      return Object.freeze(records.map(cloneRecord));
    },

    async query({ scope, layers, keys = [], now = clock().toISOString() }) {
      const keySet = new Set(keys);
      const layerSet = new Set(layers);
      const instant = Date.parse(now);
      const result = [];
      let excludedExpired = 0;
      let excludedScope = 0;

      for (const record of records) {
        if (!sameScope(record.scope, scope)) {
          excludedScope += 1;
          continue;
        }
        if (!layerSet.has(record.layer)) continue;
        if (keySet.size > 0 && !keySet.has(record.key)) continue;
        if (record.expiresAt && Date.parse(record.expiresAt) <= instant) {
          excludedExpired += 1;
          continue;
        }
        result.push(cloneRecord(record));
      }

      result.sort((a, b) => {
        const layerCompare = a.layer.localeCompare(b.layer);
        if (layerCompare !== 0) return layerCompare;
        const keyCompare = a.key.localeCompare(b.key);
        if (keyCompare !== 0) return keyCompare;
        return a.createdAt.localeCompare(b.createdAt);
      });

      return Object.freeze({
        records: Object.freeze(result),
        diagnostics: Object.freeze({ excludedExpired, excludedScope })
      });
    }
  });
}
