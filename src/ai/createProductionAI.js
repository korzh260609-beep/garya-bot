import { createAIRouter } from './router.js';
import { createRegistryFromEnvironment } from './modelRegistry.js';
import { createInMemoryAITelemetry } from './telemetry.js';
import { createOpenAIResponsesProvider } from './providers/openaiResponsesProvider.js';
import { createProductionMeaningInterpreter } from './productionMeaningInterpreter.js';
import { createProductionAiPolicy } from './productionPolicy.js';
import { createDeploymentCredentialManager } from '../secrets/credentialManager.js';

function nonNegativeInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createProductionAI({
  env = process.env,
  fetchImpl = globalThis.fetch,
  telemetry = createInMemoryAITelemetry(),
  configurationPolicy = null,
  credentialManager = null,
  credentialAccessContext = null,
  openAiCredentialId = 'sg.openai.primary',
} = {}) {
  const policy = createProductionAiPolicy(env);
  const registry = createRegistryFromEnvironment(env);
  const aiConfig = configurationPolicy?.ai ?? null;
  if (aiConfig && (aiConfig.routerOnly !== true || aiConfig.directProviderCallsAllowed !== false)) throw new TypeError('unsafe AI configuration policy');
  const standaloneCredentials = credentialManager ? null : createDeploymentCredentialManager({ env });
  const effectiveCredentialManager = credentialManager ?? standaloneCredentials.manager;
  const effectiveCredentialAccessContext = credentialAccessContext ?? standaloneCredentials.accessContext;
  if (!effectiveCredentialManager || typeof effectiveCredentialManager.useCredential !== 'function') throw new TypeError('credentialManager is required for production AI');
  if (!effectiveCredentialAccessContext?.actor || !effectiveCredentialAccessContext?.scope) throw new TypeError('credentialAccessContext is required for production AI');
  const openai = createOpenAIResponsesProvider({
    credentialManager: effectiveCredentialManager,
    credentialAccessContext: effectiveCredentialAccessContext,
    credentialId: openAiCredentialId,
    baseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    reasoningEffort: env.OPENAI_REASONING_EFFORT ?? 'medium',
    fetchImpl,
  });
  const aiRouter = createAIRouter({
    registry,
    providers: { openai },
    telemetry,
    policy,
    timeoutMs: aiConfig?.timeoutMs ?? positiveInteger(env.AI_TIMEOUT_MS, 30_000),
    maxRetries: aiConfig?.maxRetries ?? nonNegativeInteger(env.AI_MAX_RETRIES, 1),
    retryDelayMs: aiConfig?.retryDelayMs ?? nonNegativeInteger(env.AI_RETRY_DELAY_MS, 100),
  });
  const meaningInterpreter = createProductionMeaningInterpreter({ aiRouter, fallbackOnFailure: true });
  return Object.freeze({ policy, registry, telemetry, aiRouter, meaningInterpreter, credentialId: openAiCredentialId });
}
