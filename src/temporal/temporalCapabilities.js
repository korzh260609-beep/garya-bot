import { createCapability } from '../contracts/capability.js';

export const TEMPORAL_CAPABILITY_NAMES = Object.freeze(['time-read', 'timezone-set', 'memory-time-read']);

function capability(input) {
  return createCapability({
    version: '1.0.0', timeoutMs: 5000, maxRetries: 0, estimatedCostUsd: 0,
    requiredPermissions: [`capability:${input.name}`], requiredSources: [], requiredTools: [], fallbackCapabilities: [],
    ...input
  });
}

function scopeFrom(request) {
  return Object.freeze({
    userScope: request.scope.userScope,
    projectScope: request.scope.projectScope,
    groupScope: request.scope.groupScope ?? null,
    threadScope: request.scope.threadScope ?? null
  });
}

export function createTemporalCapabilities({ temporalService, memoryProvider = null } = {}) {
  if (!temporalService?.contextForUser || !temporalService?.setUserTimezone) throw new TypeError('temporalService is required');

  const result = [
    capability({
      name: 'time-read', description: 'Read current UTC and user-local time from deterministic Temporal Context.',
      actionTypes: ['time-read'], actionClasses: ['read-only'],
      execute: async (request) => {
        const context = await temporalService.contextForUser(request.actor.globalUserId);
        const mode = request.input?.mode ?? 'both';
        const message = mode === 'utc'
          ? `UTC time: ${context.utc}.`
          : context.timezoneKnown
            ? `UTC time: ${context.utc}. Local time: ${context.localDateTime} (${context.timeZone}).`
            : `UTC time: ${context.utc}. Your local timezone is not set yet.`;
        return { status: 'success', data: { context, message } };
      }
    }),
    capability({
      name: 'timezone-set', description: 'Set the current global user IANA timezone.',
      actionTypes: ['timezone-set'], actionClasses: ['state-changing'], confirmationRequired: false,
      execute: async (request) => {
        const timeZone = String(request.input?.timeZone ?? '').trim();
        if (!temporalService.isValidTimeZone(timeZone)) {
          return { status: 'failed', error: { code: 'invalid-timezone', message: 'A valid IANA timezone is required', retryable: false } };
        }
        const record = await temporalService.setUserTimezone(request.actor.globalUserId, timeZone, {
          source: 'user-explicit',
          provenance: { requestId: request.traceContext.requestId, capability: 'timezone-set' }
        });
        const context = await temporalService.contextForUser(request.actor.globalUserId);
        return { status: 'success', data: { setting: record, context, message: `Timezone set to ${timeZone}. Local time: ${context.localDateTime}.` } };
      }
    })
  ];

  if (memoryProvider?.query) {
    result.push(capability({
      name: 'memory-time-read', description: 'Read scoped memory records inside a deterministic Temporal Context range.',
      actionTypes: ['memory-time-read'], actionClasses: ['read-only', 'private-data'],
      execute: async (request) => {
        const temporalRange = request.input?.temporalRange ?? null;
        if (!temporalRange?.utcStart) {
          return { status: 'failed', error: { code: 'temporal-range-required', message: 'A normalized temporal range is required', retryable: false } };
        }
        const query = await memoryProvider.query({
          scope: scopeFrom(request),
          layers: request.input?.layers ?? ['session', 'user-memory', 'project-memory'],
          keys: request.input?.keys ?? [],
          now: temporalService.now().toISOString(),
          temporalRange
        });
        return { status: 'success', data: { records: query.records, diagnostics: query.diagnostics, temporalRange, message: `Memory records in period: ${query.records.length}` } };
      }
    }));
  }

  return Object.freeze(result);
}
