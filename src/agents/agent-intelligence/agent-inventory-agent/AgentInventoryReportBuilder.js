// AGENT NOTE:
// AgentInventoryAgent report builder skeleton.
// Purpose: build a deterministic inventory from provided agent metadata only.
// Do not read repository files, call runtime, Telegram, Render, GitHub, DB, AI, or filesystem here.

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function groupByLayer(agents = []) {
  const grouped = {};

  for (const agent of asArray(agents)) {
    const layer = String(agent?.layer || "unknown");
    grouped[layer] = grouped[layer] || [];
    grouped[layer].push({
      id: agent?.id || "unknown-agent",
      name: agent?.name || "UnknownAgent",
      modulePath: agent?.modulePath || null,
      capability: agent?.capability || null,
      canChangeState: agent?.canChangeState === true,
      tokensSpent: agent?.tokensSpent === true,
      connectedToRuntime: agent?.connectedToRuntime === true,
      connectedToAI: agent?.connectedToAI === true,
    });
  }

  return grouped;
}

function collectSafetyWarnings(agents = []) {
  const warnings = [];

  for (const agent of asArray(agents)) {
    if (agent?.canChangeState === true) warnings.push(`${agent.id}:canChangeState_true`);
    if (agent?.tokensSpent === true) warnings.push(`${agent.id}:tokensSpent_true`);
    if (agent?.connectedToRuntime === true) warnings.push(`${agent.id}:connectedToRuntime_true`);
    if (agent?.connectedToAI === true) warnings.push(`${agent.id}:connectedToAI_true`);
  }

  return warnings;
}

export function buildAgentInventoryReport({ agents = [], metadata = {} } = {}) {
  const safeAgents = asArray(agents);
  const groupedByLayer = groupByLayer(safeAgents);
  const safetyWarnings = collectSafetyWarnings(safeAgents);

  return {
    totalAgents: safeAgents.length,
    groupedByLayer,
    safetyWarnings,
    canChangeState: false,
    tokensSpent: false,
    metadata: {
      ...metadata,
      mode: "agent_inventory_report_skeleton_v1",
      source: "provided_agent_metadata_only",
      readsRepository: false,
      connectedToRuntime: false,
      connectedToAI: false,
    },
  };
}

export default {
  buildAgentInventoryReport,
};
