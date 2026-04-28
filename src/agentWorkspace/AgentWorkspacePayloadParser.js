// src/agentWorkspace/AgentWorkspacePayloadParser.js
// ============================================================================
// AgentWorkspace Payload Parser
// Small pure helpers for parsing COMMANDS.md payload values.
// ============================================================================

export function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseDiagnosticCommandLines(payload = "") {
  const lines = String(payload || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.startsWith("/"));

  // IMPORTANT:
  // Keep the full command line with arguments.
  // Example: "/render_bridge_logs latest 100" must not be reduced to
  // only "/render_bridge_logs", otherwise SG cannot return requested logs.
  return Array.from(new Set(lines));
}

export function parseBooleanPayloadFlag(payload = "", names = []) {
  const lines = String(payload || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const normalizedNames = names
    .map((name) => normalizeString(name).toLowerCase())
    .filter(Boolean);

  return lines.some((line) => {
    const normalizedLine = line.toLowerCase().replace(/\s+/g, "");

    return normalizedNames.some((name) => {
      const normalizedName = name.replace(/\s+/g, "");
      return line === name ||
        normalizedLine === `${normalizedName}=true` ||
        normalizedLine === `${normalizedName}:true` ||
        normalizedLine === `${normalizedName}yes` ||
        normalizedLine === `${normalizedName}=yes` ||
        normalizedLine === `${normalizedName}:yes`;
    });
  });
}

export function parseRepoStateAgentOptions(payload = "") {
  return {
    forceAiAnalysis: parseBooleanPayloadFlag(payload, [
      "forceAiAnalysis",
      "force_ai_analysis",
    ]),
    allowRealAi: parseBooleanPayloadFlag(payload, [
      "allowRealAi",
      "allow_real_ai",
    ]),
  };
}

export default {
  normalizeString,
  parseDiagnosticCommandLines,
  parseBooleanPayloadFlag,
  parseRepoStateAgentOptions,
};
