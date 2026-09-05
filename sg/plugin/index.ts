import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { registerWorkspaceManager } from "./register.js";

export * from "./context.js";
export * from "./personal-workspace.js";
export * from "./cost-diagnostics.js";
export * from "./context-diagnostics.js";
export { SgGlobalProfileRegistry, validateGlobalProfileStore } from "./citizenship-registry.js";
export type {
  SgGlobalProfile,
  SgGlobalProfileStore,
  SgIdentityLink,
  SgPersistedProjectRole,
  SgProfileStatus,
} from "./citizenship-registry.js";
export * from "./register.js";
export * from "./workspace-registry.js";
export * from "./workspace-requests.js";
export * from "./workspace-tools.js";
export * from "./workspace-memberships.js";
export * from "./wsp4-diagnostics.js";
export * from "./wsp4-tools.js";
export * from "./content-registry.js";
export * from "./wsp5-diagnostics.js";
export * from "./wsp5-lifecycle.js";
export * from "./wsp5-tools.js";
export * from "./wsp6-assessments.js";
export * from "./wsp6-diagnostics.js";
export * from "./wsp6-interactive.js";
export * from "./wsp6-lifecycle.js";
export * from "./wsp6-store.js";
export * from "./wsp6-tools.js";

export default definePluginEntry({
  id: "sg-workspace-manager",
  name: "SG Workspace Manager",
  description: "Adds SG workspace semantics above OpenClaw",
  register: registerWorkspaceManager,
});
