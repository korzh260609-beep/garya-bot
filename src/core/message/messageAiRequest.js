// AGENT NOTE:
// SG 2.0 message AI request builder.
// Purpose: isolate AI request construction for normal text messages from handleMessage.
// Explicit diagnostics requests are handled deterministically before the model call.

import { callAI } from "../../ai/callAI.js";
import { buildSgSystemPrompt } from "../sgSystemPrompt.js";
import { handleMessageDiagnosticsRoute } from "./messageDiagnosticsRoute.js";
import { prepareMessageContextInjection } from "./messageContextInjection.js";
import {
  getMessageProjectMemoryContextGateOptionsFromEnv,
  prepareMessageProjectMemoryContextGate,
} from "./messageProjectMemoryContextGate.js";

export async function callMessageAI({ identity, text, behaviorRuntime, explicitProjectContext = null }) {
  const diagnosticsRoute = await handleMessageDiagnosticsRoute({
    text,
    identity,
  });

  if (diagnosticsRoute.handled) {
    return {
      text: diagnosticsRoute.reply,
      metadata: {
        diagnosticsRoute: diagnosticsRoute.diagnosticsRoute || null,
      },
    };
  }

  const projectMemoryContextGate = await prepareMessageProjectMemoryContextGate({
    identity,
    text,
    behaviorRuntime,
    options: getMessageProjectMemoryContextGateOptionsFromEnv(),
    explicitProjectContext,
  });
  const contextPack = projectMemoryContextGate.contextPack;
  const baseMessages = [
    { role: "system", content: buildSgSystemPrompt(identity) },
    { role: "user", content: text },
  ];
  const contextInjection = prepareMessageContextInjection({
    messages: baseMessages,
    contextPack,
    options: projectMemoryContextGate.contextInjectionOptions,
  });

  return callAI(
    contextInjection.messages,
    {
      maxOutputTokens: 500,
      identity,
      latestUserText: text,
      behaviorRuntime,
      contextPack,
      contextInjection,
      projectMemoryContextGate,
      returnMetadata: true,
    }
  );
}
