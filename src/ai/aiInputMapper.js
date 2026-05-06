// AGENT NOTE:
// SG 2.0 AI input mapper.
// Purpose: isolate chat-style messages to OpenAI Responses API input conversion.
// Do not add prompt assembly, model routing, tool execution, or transport logic here.

export function toResponseInput(messages) {
  return Array.isArray(messages)
    ? messages.map((message) => ({
        role: message?.role === "system" ? "developer" : message?.role || "user",
        content: String(message?.content ?? ""),
      }))
    : [];
}
