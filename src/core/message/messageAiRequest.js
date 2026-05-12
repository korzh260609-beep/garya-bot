// AGENT NOTE:
// SG 2.0 message AI request builder.
// Purpose: isolate AI request construction for normal text messages from handleMessage.
// Do not add OpenAI client logic, tool execution, transport logic, or access checks here.
// Memory/Context injection must pass through messageContextInjection boundary and stay disabled unless explicitly approved.

import { callAI } from "../../ai/callAI.js";
import { buildSgSystemPrompt } from "../sgSystemPrompt.js";
import { prepareMessageContextInjection } from "./messageContextInjection.js";
import {
  getMessageProjectMemoryContextGateOptionsFromEnv,
  prepareMessageProjectMemoryContextGate,
} from "./messageProjectMemoryContextGate.js";

export async function callMessageAI({ identity, text, behaviorRuntime, explicitProjectContext = null }) {
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
