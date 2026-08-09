import { createCapability } from '../contracts/capability.js';

export const MEMORY2_CAPABILITY_NAMES = Object.freeze([
  'memory2-write',
  'memory2-recall',
  'memory2-diagnostics',
  'memory2-confirm',
  'memory2-promote',
  'memory2-archive',
  'memory2-history'
]);

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function scopeFrom(request) {
  return Object.freeze({ userScope: request.scope.userScope, projectScope: request.scope.projectScope, groupScope: request.scope.groupScope ?? null, threadScope: request.scope.threadScope ?? null });
}
function capability(input) {
  return createCapability({ version: '1.0.0', timeoutMs: 10000, maxRetries: 0, estimatedCostUsd: 0, requiredPermissions: [`capability:${input.name}`], requiredSources: [], requiredTools: [], fallbackCapabilities: [], ...input });
}

export function createMemory2Capabilities({ memory2Service } = {}) {
  if (!memory2Service?.write || !memory2Service?.recall || !memory2Service?.diagnostics) throw new TypeError('memory2Service is required');
  return Object.freeze([
    capability({
      name: 'memory2-write', description: 'Write personal or shared Memory 2.0 through scope/privacy policy.', actionTypes: ['memory-write'], actionClasses: ['state-changing','private-data'], confirmationRequired: true,
      execute: async (request) => {
        const input = request.input ?? {};
        const result = await memory2Service.write({
          layer: input.layer,
          key: required(input.key,'input.key'),
          value: input.value,
          scope: scopeFrom(request),
          scopeKind: input.scopeKind ?? null,
          shared: input.shared === true,
          privacyClass: input.privacyClass ?? null,
          actor: request.actor,
          resourceAuthority: request.resourceAuthority ?? null,
          provenance: { sourceType: 'capability', sourceId: request.traceContext.requestId, actorId: request.actor.globalUserId },
          trust: input.trust ?? (input.confirmed === false ? 'reported' : 'confirmed'),
          confirmed: input.confirmed !== false,
          expiresAt: input.expiresAt ?? null,
          temporary: input.temporary === true,
          retentionClass: input.retentionClass ?? null,
          tags: input.tags ?? [],
          confidence: input.confidence ?? null
        });
        return { status: result.status === 'conflict' ? 'partial' : 'success', data: { ...result, message: `Memory ${result.status}` }, warnings: result.status === 'conflict' ? ['memory-conflict-visible'] : [] };
      }
    }),
    capability({
      name: 'memory2-recall', description: 'Recall the smallest authorized Memory 2.0 context.', actionTypes: ['memory-read'], actionClasses: ['read-only','private-data'],
      execute: async (request) => {
        const result = await memory2Service.recall({ scope: scopeFrom(request), actor: request.actor, query: request.input?.query ?? request.input?.text ?? '', layers: request.input?.layers ?? [], keys: request.input?.keys ?? [], maxRecords: request.input?.maxRecords ?? 20, maxCharacters: request.input?.maxCharacters ?? 12000, includeHistory: request.input?.includeHistory === true });
        return { status: 'success', data: { ...result, message: `Memory 2.0 records: ${result.records.length}` } };
      }
    }),
    capability({
      name: 'memory2-diagnostics', description: 'Return bounded authorized Memory 2.0 statistics.', actionTypes: ['memory-diagnostics'], actionClasses: ['read-only','private-data'],
      execute: async (request) => ({ status: 'success', data: { report: await memory2Service.diagnostics({ scope: scopeFrom(request), actor: request.actor }), message: 'Memory 2.0 diagnostics ready' } })
    }),
    capability({
      name: 'memory2-confirm', description: 'Confirm one proposed memory record within authority.', actionTypes: ['memory-confirm'], actionClasses: ['state-changing','private-data'], confirmationRequired: true,
      execute: async (request) => {
        const record = await memory2Service.confirm({ memoryId: required(request.input?.memoryId,'input.memoryId'), scope: scopeFrom(request), actor: request.actor });
        return record ? { status: 'success', data: { record, message: 'Memory confirmed' } } : { status: 'failed', error: { code: 'memory-not-found', message: 'Memory not found', retryable: false } };
      }
    }),
    capability({
      name: 'memory2-promote', description: 'Explicitly promote memory between scopes under policy.', actionTypes: ['memory-promote'], actionClasses: ['state-changing','private-data'], confirmationRequired: true,
      execute: async (request) => {
        const result = await memory2Service.promote({ memoryId: required(request.input?.memoryId,'input.memoryId'), targetScopeKind: required(request.input?.targetScopeKind,'input.targetScopeKind'), scope: scopeFrom(request), actor: request.actor, resourceAuthority: request.resourceAuthority ?? null });
        return result ? { status: result.status === 'conflict' ? 'partial' : 'success', data: { ...result, message: `Memory promoted: ${result.status}` }, warnings: result.status === 'conflict' ? ['memory-conflict-visible'] : [] } : { status: 'failed', error: { code: 'memory-not-found', message: 'Memory not found', retryable: false } };
      }
    }),
    capability({
      name: 'memory2-archive', description: 'Archive one authorized memory record without deleting history.', actionTypes: ['memory-archive'], actionClasses: ['state-changing','private-data'], confirmationRequired: true,
      execute: async (request) => {
        const record = await memory2Service.archive({ memoryId: required(request.input?.memoryId,'input.memoryId'), scope: scopeFrom(request), actor: request.actor });
        return record ? { status: 'success', data: { record, message: 'Memory archived' } } : { status: 'failed', error: { code: 'memory-not-found', message: 'Memory not found', retryable: false } };
      }
    }),
    capability({
      name: 'memory2-history', description: 'Inspect authorized memory provenance and supersession history.', actionTypes: ['memory-history'], actionClasses: ['read-only','private-data'],
      execute: async (request) => {
        const result = await memory2Service.inspect({ memoryId: required(request.input?.memoryId,'input.memoryId'), scope: scopeFrom(request), actor: request.actor });
        return result ? { status: 'success', data: { ...result, message: 'Memory history ready' } } : { status: 'failed', error: { code: 'memory-not-found-or-denied', message: 'Memory not found in authorized scope', retryable: false } };
      }
    })
  ]);
}
