import { getGlobalHookRunner } from "../../plugins/hook-runner-global.js";
import type {
  PluginHookAgentContext,
  PluginHookBillableOperationCompletedEvent,
} from "../../plugins/hook-types.js";
import type { AgentGeneratedAttachment } from "../generated-attachments.js";

export type MediaGenerationExecutionResult = {
  provider: string;
  model: string;
  count: number;
  wakeResult: string;
  attachments?: AgentGeneratedAttachment[];
  mediaUrls?: string[];
  billableOperation?: Omit<
    PluginHookBillableOperationCompletedEvent,
    "runId" | "toolCallId" | "provider" | "model" | "outcome"
  > & {
    providerRequestId?: string;
  };
};

export async function runMediaGenerationBillableCompletionHook(params: {
  result: MediaGenerationExecutionResult;
  handle: {
    runId: string;
    toolCallId?: string;
    requesterSessionKey: string;
    requesterAgentId?: string;
  } | null;
  toolName: string;
}): Promise<void> {
  const billableOperation = params.result.billableOperation;
  const hookRunner = getGlobalHookRunner();
  if (!billableOperation || !hookRunner?.hasHooks("billable_operation_completed")) {
    return;
  }
  const runId = params.handle?.runId ?? `${params.toolName}:foreground`;
  const event = Object.freeze({
    runId,
    ...(params.handle?.toolCallId ? { toolCallId: params.handle.toolCallId } : {}),
    provider: params.result.provider,
    model: params.result.model,
    outcome: "completed" as const,
    ...billableOperation,
  });
  const ctx = Object.freeze({
    runId,
    ...(params.handle?.requesterSessionKey
      ? { sessionKey: params.handle.requesterSessionKey }
      : {}),
    ...(params.handle?.requesterAgentId ? { agentId: params.handle.requesterAgentId } : {}),
    modelProviderId: params.result.provider,
    modelId: params.result.model,
  }) satisfies PluginHookAgentContext;
  await hookRunner.runBillableOperationCompleted(event, ctx);
}

export async function runMediaGenerationBillableFailureHook(params: {
  category?: string;
  handle: {
    runId: string;
    toolCallId?: string;
    requesterSessionKey: string;
    requesterAgentId?: string;
  } | null;
}): Promise<void> {
  const hookRunner = getGlobalHookRunner();
  if (!params.category || !params.handle || !hookRunner?.hasHooks("billable_operation_completed")) {
    return;
  }
  const event = Object.freeze({
    runId: params.handle.runId,
    ...(params.handle.toolCallId ? { toolCallId: params.handle.toolCallId } : {}),
    category: params.category,
    outcome: "error" as const,
  });
  const ctx = Object.freeze({
    runId: params.handle.runId,
    sessionKey: params.handle.requesterSessionKey,
    ...(params.handle.requesterAgentId ? { agentId: params.handle.requesterAgentId } : {}),
  }) satisfies PluginHookAgentContext;
  await hookRunner.runBillableOperationCompleted(event, ctx);
}
