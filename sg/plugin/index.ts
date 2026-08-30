import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { registerWorkspaceManager } from "./register.js";

export * from "./context.js";
export * from "./register.js";
export * from "./workspace-registry.js";

export default definePluginEntry({
  id: "sg-workspace-manager",
  name: "SG Workspace Manager",
  description: "Adds SG workspace semantics above OpenClaw",
  register: registerWorkspaceManager,
});
