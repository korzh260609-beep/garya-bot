// AGENT NOTE:
// SG 2.0 AI tool context builder.
// Purpose: isolate runtime context passed from AI layer into tool execution.
// Do not add tool execution, approval logic, or transport formatting here.

export function buildToolContext(options = {}) {
  const identity = options.identity || {};

  return {
    userId: identity.platformUserId || null,
    globalUserId: identity.globalUserId || null,
    role: identity.role || "guest",
    isMonarch: Boolean(identity.isMonarch),
    latestUserText: String(options.latestUserText || ""),
  };
}
