import { createCapability } from '../contracts/capability.js';

export const TEMPORAL_CAPABILITY_NAMES = Object.freeze(['time-read', 'timezone-set']);

function capability(input) {
  return createCapability({
    version: '1.0.0', timeoutMs: 5000, maxRetries: 0, estimatedCostUsd: 0,
    requiredPermissions: [`capability:${input.name}`], requiredSources: [], requiredTools: [], fallbackCapabilities: [],
    ...input
  });
}

export function createTemporalCapabilities({ temporalService } = {}) {
  if (!temporalService?.contextForUser || !temporalService?.setUserTimezone) throw new TypeError('temporalService is required');

  return Object.freeze([
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
  ]);
}
