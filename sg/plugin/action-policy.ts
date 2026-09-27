import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { SgBillingLedger } from "./billing-ledger.js";
import { resolveSgCanonicalIdentity } from "./context.js";
import { SgGlobalProfileRegistry } from "./global-profile-registry.js";

type SgActionPolicyApi = {
  config?: OpenClawPluginApi["config"];
  on: OpenClawPluginApi["on"];
  logger?: { warn(message: string): void };
};

const BILLING_ADMIN_ACTIONS = new Set([
  "project_report",
  "user_report",
  "balance",
  "history",
  "reconcile",
  "diagnostics",
  "credit",
  "resolve_stale_monarch",
  "bind_automation",
]);
const BILLING_MUTATIONS = new Set(["credit", "resolve_stale_monarch", "bind_automation"]);
const RENDER_MUTATIONS = new Set([
  "deploy_commit",
  "cancel_deploy",
  "restart_service",
  "rollback_service",
  "set_env",
]);
const MONARCH_TOOLS = new Set([
  "sg_render",
  "sg_content_review",
  "sg_content_publish",
  "sg_content_schedule",
  "sg_test_manage",
  "sg_test_stats",
]);

function approvalFor(toolName: string, action: unknown) {
  if (toolName === "sg_render" && typeof action === "string" && RENDER_MUTATIONS.has(action)) {
    return {
      title: "Подтвердить изменение Render",
      description: `SG выполнит Render action=${action}.`,
      severity: "critical" as const,
      allowedDecisions: ["allow-once", "deny"] as Array<"allow-once" | "deny">,
    };
  }
  if (
    toolName === "sg_billing_manage" &&
    typeof action === "string" &&
    BILLING_MUTATIONS.has(action)
  ) {
    return {
      title: "Подтвердить изменение биллинга",
      description: `SG выполнит billing action=${action}.`,
      severity: "critical" as const,
      allowedDecisions: ["allow-once", "deny"] as Array<"allow-once" | "deny">,
    };
  }
  return undefined;
}

export function registerSgActionPolicy(params: { api: SgActionPolicyApi; stateDir: string }): void {
  const { api, stateDir } = params;
  const profiles = new SgGlobalProfileRegistry(stateDir);
  const ledger = new SgBillingLedger(stateDir);
  const resolveRole = async (ctx: {
    requester?: { channel?: string; senderId?: string };
    sessionKey?: string;
  }) => {
    const channel = ctx.requester?.channel;
    const senderId = ctx.requester?.senderId;
    if (channel && senderId) {
      const canonicalIdentity = resolveSgCanonicalIdentity({
        channel,
        senderId,
        identityLinks: api.config?.session?.identityLinks,
      });
      if (canonicalIdentity) {
        return (await profiles.findByCanonicalIdentity(canonicalIdentity))?.role;
      }
    }
    const sessionOwner = ctx.sessionKey
      ? await ledger.resolveSessionOwner(ctx.sessionKey)
      : undefined;
    if (!sessionOwner) {
      return undefined;
    }
    const profile = await profiles.findByGlobalId(sessionOwner.globalId);
    return profile?.status === "active" && profile.role === sessionOwner.role
      ? profile.role
      : undefined;
  };

  api.on("before_tool_call", async (event, ctx) => {
    const action = event.params.action;
    const billingAdmin =
      event.toolName === "sg_billing_manage" &&
      typeof action === "string" &&
      BILLING_ADMIN_ACTIONS.has(action);
    if (MONARCH_TOOLS.has(event.toolName) || billingAdmin) {
      try {
        if ((await resolveRole(ctx)) !== "monarch") {
          return { block: true, blockReason: "SG monarch Global ID is required" };
        }
      } catch (error) {
        api.logger?.warn(
          `[sg-policy] role lookup failed safely: ${error instanceof Error ? error.message : String(error)}`,
        );
        return { block: true, blockReason: "SG could not verify the actor Global ID and role" };
      }
    }
    const requireApproval = approvalFor(event.toolName, action);
    return requireApproval ? { requireApproval } : undefined;
  });

  api.on("gateway_stop", () => ledger.close());
}
