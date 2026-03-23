// src/bot/handlers/chat/sourceFlow.js

import {
  resolveSourceContext,
  buildSourceServiceDebugBlock,
} from "../../../sources/sourceService.js";

export async function resolveChatSourceFlow({ effective }) {
  let sourceCtx = null;
  let sourceServiceDebugBlock = "";

  try {
    sourceCtx = await resolveSourceContext({
      text: effective,
      sourceResult: null,
      sourceKey: null,
      requireSource: false,
      allowedSourceKeys: [],
    });

    sourceServiceDebugBlock = buildSourceServiceDebugBlock({
      text: effective,
      sourceResult: null,
      sourceKey: null,
      requireSource: false,
      allowedSourceKeys: [],
    });
  } catch (e) {
    console.error("ERROR sourceService resolve failed (fail-open):", e);
    sourceCtx = {
      version: "10.6-skeleton-v1",
      ok: false,
      usedExistingSourceResult: false,
      shouldUseSourceResult: false,
      shouldRequireSourceResult: false,
      sourceRuntime: {
        decision: "skip",
        needsSource: false,
        reason: "source_service_fail_open",
      },
      sourcePlan: {
        decision: "noop",
        reason: "source_service_fail_open",
      },
      sourceResult: {
        ok: false,
        sourceKey: null,
        content: "",
        fetchedAt: null,
        meta: {
          reason: "source_service_fail_open",
        },
      },
      reason: "source_service_fail_open",
    };

    sourceServiceDebugBlock = [
      "SOURCE SERVICE:",
      "- version: 10.6-skeleton-v1",
      "- decision: noop",
      "- should_fetch: false",
      "- source_definition_found: false",
      "- source_definition_key: none",
      "- runtime_decision: skip",
      "- runtime_needs_source: false",
      "- reason: source_service_fail_open",
    ].join("\n");
  }

  const sourceContextText =
    sourceCtx?.shouldUseSourceResult === true &&
    sourceCtx?.sourceResult?.ok === true &&
    typeof sourceCtx?.sourceResult?.content === "string" &&
    sourceCtx.sourceResult.content.trim()
      ? sourceCtx.sourceResult.content.trim()
      : "";

  const sourceResultSystemMessage = sourceContextText
    ? {
        role: "system",
        content:
          `SOURCE RESULT (verified runtime data):\n` +
          `- source_key: ${sourceCtx?.sourceResult?.sourceKey || "unknown"}\n` +
          `- fetched_at: ${sourceCtx?.sourceResult?.fetchedAt || "unknown"}\n` +
          `- use this as factual runtime context when relevant\n\n` +
          `${sourceContextText}`,
      }
    : null;

  const sourceServiceSystemMessage =
    sourceServiceDebugBlock && String(sourceServiceDebugBlock).trim()
      ? {
          role: "system",
          content:
            `${sourceServiceDebugBlock}\n\n` +
            `IMPORTANT:\n` +
            `- this service block describes current source-service state\n` +
            `- factual source data is injected separately only when sourceResult.ok=true\n` +
            `- if source fetch failed or was skipped, do not pretend that the source was used`,
        }
      : null;

  return {
    sourceCtx,
    sourceServiceDebugBlock,
    sourceContextText,
    sourceResultSystemMessage,
    sourceServiceSystemMessage,
  };
}