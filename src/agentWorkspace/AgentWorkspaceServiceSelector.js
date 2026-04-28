// src/agentWorkspace/AgentWorkspaceServiceSelector.js
// ============================================================================
// AgentWorkspace Service Selector
// Helpers for selecting the Render service used by workspace diagnostics.
// ============================================================================

export function serviceMatchesGaryaBot(service = {}) {
  const name = String(service?.name || "").toLowerCase();
  const slug = String(service?.slug || "").toLowerCase();
  return name === "garya-bot" || slug === "garya-bot";
}

export async function ensureGlobalRenderServiceSelected({
  renderBridge,
  renderBridgeStateStore,
}) {
  const current = await renderBridgeStateStore.getState("global");
  if (current?.selected_service_id) {
    return current;
  }

  const services = await renderBridge.listServices();
  const selected = services.find(serviceMatchesGaryaBot) || (services.length === 1 ? services[0] : null);

  if (!selected?.id) {
    throw new Error("agent_workspace_no_render_service_available_for_global_runner");
  }

  return renderBridgeStateStore.setSelectedService({
    ownerKey: "global",
    serviceId: selected.id,
    serviceName: selected.name || selected.slug || "garya-bot",
    serviceSlug: selected.slug || selected.name || "garya-bot",
    ownerId: selected.ownerId || selected.owner?.id || selected.owner_id || null,
  });
}

export default {
  serviceMatchesGaryaBot,
  ensureGlobalRenderServiceSelected,
};
