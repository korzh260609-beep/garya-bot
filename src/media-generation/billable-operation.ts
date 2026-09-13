import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import type { PluginHookAgentContext } from "../plugins/hook-types.js";

export type MediaGenerationBillingContext = {
  runId: string;
  toolCallId?: string;
  sessionKey?: string;
  agentId?: string;
};

export class MediaGenerationBillingBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaGenerationBillingBlockedError";
  }
}

export async function authorizeMediaGenerationProviderCall(params: {
  billingContext?: MediaGenerationBillingContext;
  category: "image_generation" | "video_generation" | "music_generation";
  provider: string;
  model: string;
  costUpperBoundUsd?: number;
}): Promise<boolean> {
  const hookRunner = getGlobalHookRunner();
  if (!hookRunner?.hasHooks("before_billable_operation")) {
    return false;
  }
  const runId = params.billingContext?.runId ?? `${params.category}:foreground`;
  const event = Object.freeze({
    runId,
    ...(params.billingContext?.toolCallId ? { toolCallId: params.billingContext.toolCallId } : {}),
    category: params.category,
    provider: params.provider,
    model: params.model,
    ...(params.costUpperBoundUsd === undefined
      ? {}
      : {
          costUpperBound: {
            totalUsd: params.costUpperBoundUsd,
            evidence: "catalog-upper-bound" as const,
          },
        }),
  });
  const ctx = Object.freeze({
    runId,
    ...(params.billingContext?.sessionKey ? { sessionKey: params.billingContext.sessionKey } : {}),
    ...(params.billingContext?.agentId ? { agentId: params.billingContext.agentId } : {}),
    modelProviderId: params.provider,
    modelId: params.model,
  }) satisfies PluginHookAgentContext;
  const result = await hookRunner.runBeforeBillableOperation(event, ctx);
  if (result?.block) {
    throw new MediaGenerationBillingBlockedError(
      result.blockReason?.trim() || "Paid media operation was not authorized",
    );
  }
  return true;
}
