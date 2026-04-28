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

  return Array.from(new Set(lines.map((line) => line.split(/\s+/)[0])));
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
      return normalizedLine === `${normalizedName}=true` ||
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
  };
}

export default {
  normalizeString,
  parseDiagnosticCommandLines,
  parseBooleanPayloadFlag,
  parseRepoStateAgentOptions,
};
