import { randomUUID } from 'node:crypto';
import { createMemoryRecord, createMemoryWriteRequest } from '../contracts/memory.js';

function stableValue(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(',')}}`;
}

function toRepoScope(scope) {
  return { globalUserId: scope.userScope, projectScope: scope.projectScope, groupScope: scope.groupScope, threadScope: scope.threadScope };
}

function fromRow(row) {
  return createMemoryRecord({
    id: row.memory_id,
    layer: row.memory_layer,
    key: row.memory_key,
    value: row.value,
    scope: { userScope: row.global_user_id, projectScope: row.project_scope, groupScope: row.group_scope, threadScope: row.thread_scope },
    provenance: row.provenance,
    trust: row.trust,
    confirmed: row.confirmed,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    tags: row.tags
  });
}

export function createPostgresMemoryProvider({ memoryRepository, clock = () => new Date() } = {}) {
  if (!memoryRepository?.put || !memoryRepository?.list) throw new TypeError('memoryRepository with put and list is required');
  return Object.freeze({
    name: 'postgres-memory-provider',
    async write(rawRequest) {
      const request = createMemoryWriteRequest(rawRequest);
      const rows = await memoryRepository.list({ scope: toRepoScope(request.scope), layers: [request.layer], keys: [request.key], includeExpired: true });
      const duplicate = rows.find((row) => stableValue(row.value) === stableValue(request.value));
      if (duplicate) return Object.freeze({ status: 'duplicate', record: fromRow(duplicate), conflictIds: Object.freeze([]) });
      const row = await memoryRepository.put({
        memoryId: randomUUID(), scope: toRepoScope(request.scope), layer: request.layer, key: request.key, value: request.value,
        provenance: request.provenance, trust: request.trust, confirmed: request.confirmed, tags: request.tags, expiresAt: request.expiresAt
      });
      return Object.freeze({ status: rows.length ? 'conflict' : 'written', record: fromRow(row), conflictIds: Object.freeze(rows.map((item) => item.memory_id)) });
    },
    async listAll() {
      throw new Error('listAll is intentionally unavailable without an explicit scope');
    },
    async query({ scope, layers, keys = [], now = clock().toISOString() }) {
      const rows = await memoryRepository.list({ scope: toRepoScope(scope), layers, keys, includeExpired: true });
      const instant = Date.parse(now);
      const records = [];
      let excludedExpired = 0;
      for (const row of rows) {
        if (row.expires_at && Date.parse(row.expires_at) <= instant) { excludedExpired += 1; continue; }
        records.push(fromRow(row));
      }
      return Object.freeze({ records: Object.freeze(records), diagnostics: Object.freeze({ excludedExpired, excludedScope: 0 }) });
    }
  });
}
