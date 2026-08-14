import { createCapability } from '../contracts/capability.js';

export const USER_SETTINGS_CAPABILITY_NAMES = Object.freeze(['user-settings-get', 'user-settings-set']);
export const USER_SETTINGS_SAFE_CAPABILITY_NAMES = USER_SETTINGS_CAPABILITY_NAMES;

function capability(input) {
  return createCapability({
    version: '1.0.0', timeoutMs: 5000, maxRetries: 0, estimatedCostUsd: 0,
    requiredPermissions: [`capability:${input.name}`], requiredSources: [], requiredTools: [], fallbackCapabilities: [], risk: 'low', ...input
  });
}

export function createUserSettingsCapabilities({ userSettingsService } = {}) {
  if (!userSettingsService?.resolve || !userSettingsService?.update) throw new TypeError('userSettingsService is required');
  return Object.freeze([
    capability({
      name: 'user-settings-get',
      description: 'Read canonical effective user settings and provenance for the current global user.',
      actionTypes: ['user-settings-get'], actionClasses: ['read-only'], confirmationRequired: false,
      execute: async (request) => {
        const projectScope = request.input?.projectScope ?? request.scope?.projectScope ?? null;
        const settings = await userSettingsService.resolve(request.actor.globalUserId, { projectScope });
        return { status: 'success', data: { settings, message: 'User settings loaded' } };
      }
    }),
    capability({
      name: 'user-settings-set',
      description: 'Update canonical user preferences without weakening mandatory policy.',
      actionTypes: ['user-settings-set'], actionClasses: ['state-changing'], confirmationRequired: false,
      execute: async (request) => {
        const patch = request.input?.settings ?? request.input?.patch;
        const projectScope = request.input?.projectScope ?? null;
        const stored = await userSettingsService.update(request.actor.globalUserId, patch, {
          projectScope,
          source: 'explicit-user-request',
          provenance: { traceId: request.traceContext.traceId, requestId: request.traceContext.requestId }
        });
        const effective = await userSettingsService.resolve(request.actor.globalUserId, { projectScope });
        return { status: 'success', data: { stored, settings: effective, message: 'User settings updated' } };
      }
    })
  ]);
}
