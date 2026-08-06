import { createAIRouter } from './router.js';
import { createRegistryFromEnvironment } from './modelRegistry.js';
import { createInMemoryAITelemetry } from './telemetry.js';
import { createOpenAIResponsesProvider } from './providers/openaiResponsesProvider.js';
import { createProductionMeaningInterpreter } from './productionMeaningInterpreter.js';
import { createProductionAiPolicy } from './productionPolicy.js';

function nonNegativeInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createProductionAI({ env = process.env, fetchImpl = globalThis.fetch, telemetry = createInMemoryAITelemetry() } = {}) {
  const policy = createProductionAiPolicy(env);
  const registry = createRegistryFromEnvironment(env);
  const openai = createOpenAIResponsesProvider({
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    reasoningEffort: env.OPENAI_REASONING_EFFORT ?? 'medium',
    fetchImpl,
  });
  const aiRouter = createAIRouter({
    registry,
    providers: { openai },
    telemetry,
    policy,
    timeoutMs: positiveInteger(env.AI_TIMEOUT_MS, 30_000),
    maxRetries: nonNegativeInteger(env.AI_MAX_RETRIES, 1),
    retryDelayMs: nonNegativeInteger(env.AI_RETRY_DELAY_MS, 100),
  });
  const meaningInterpreter = createProductionMeaningInterpreter({ aiRouter, fallbackOnFailure: true });

  return Object.freeze({ policy, registry, telemetry, aiRouter, meaningInterpreter });
}
