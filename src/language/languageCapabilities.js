import { createCapability } from '../contracts/capability.js';

export const LANGUAGE_CAPABILITY_NAMES = Object.freeze(['language-preference-set', 'language-preference-get']);
export const LANGUAGE_SAFE_CAPABILITY_NAMES = LANGUAGE_CAPABILITY_NAMES;

function required(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

function capability(input) {
  return createCapability({
    version: '1.0.0', timeoutMs: 5000, maxRetries: 0, estimatedCostUsd: 0,
    requiredPermissions: [`capability:${input.name}`], requiredSources: [], requiredTools: [], fallbackCapabilities: [], risk: 'low', ...input
  });
}

export function createLanguageCapabilities({ languageContextService } = {}) {
  if (!languageContextService?.setPreferred || !languageContextService?.getPreferred) throw new TypeError('languageContextService is required');
  return Object.freeze([
    capability({
      name: 'language-preference-set',
      description: 'Set the current global user preferred response language and optional locale.',
      actionTypes: ['language-preference-set'], actionClasses: ['state-changing'], confirmationRequired: false,
      execute: async (request) => {
        const language = required(request.input?.language ?? request.input?.responseLanguage, 'input.language').toLowerCase();
        const setting = await languageContextService.setPreferred(request.actor.globalUserId, language, {
          locale: request.input?.locale ?? null,
          source: 'explicit-user-request',
          provenance: { traceId: request.traceContext.traceId, requestId: request.traceContext.requestId }
        });
        return { status: 'success', data: { setting, message: `Preferred language set to ${language}` } };
      }
    }),
    capability({
      name: 'language-preference-get',
      description: 'Read the current global user preferred response language.',
      actionTypes: ['language-preference-get'], actionClasses: ['read-only'], confirmationRequired: false,
      execute: async (request) => {
        const setting = await languageContextService.getPreferred(request.actor.globalUserId);
        return { status: 'success', data: { setting, message: setting?.language ? `Preferred language: ${setting.language}` : 'Preferred language is not set' } };
      }
    })
  ]);
}
