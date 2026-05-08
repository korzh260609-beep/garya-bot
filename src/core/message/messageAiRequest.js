// AGENT NOTE:
// SG 2.0 message AI request builder.
// Purpose: isolate AI request construction for normal text messages from handleMessage.
// Do not add OpenAI client logic, tool execution, transport logic, or access checks here.
// Memory/Context injection must pass through messageContextInjection boundary and stay disabled unless explicitly approved.

import { callAI } from "../../ai/callAI.js";
import { buildSgSystemPrompt } from "../sgSystemPrompt.js";
import { buildMessageContextInjectionDisabledOptions, prepareMessageContextInjection } from "./messageContextInjection.js";
import { buildMessageContextPack } from "./messageContextPack.js";

export async function callMessageAI({ identity, text, behaviorRuntime }) {
  const contextPack = buildMessageContextPack({ identity, text, behaviorRuntime });
  const baseMessages = [
    { role: "system", content: buildSgSystemPrompt(identity) },
    { role: "user", content: text },
  ];
  const contextInjection = prepareMessageContextInjection({
    messages: baseMessages,
    contextPack,
    options: buildMessageContextInjectionDisabledOptions(),
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
      returnMetadata: true,
    }
  );
}
