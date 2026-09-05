import { SgGlobalProfileRegistry } from "./citizenship-registry.js";
import type { SgWorkspaceContext } from "./context.js";
import { SgWorkspaceMembershipRegistry } from "./workspace-memberships.js";
import { SgWorkspaceRegistry } from "./workspace-registry.js";

export type Wsp4DiagnosticStatus = "PASS" | "FAIL" | "NOT_EXERCISED";
type DiagnosticCheck = { name: string; status: Wsp4DiagnosticStatus; detail: string };

function check(name: string, status: Wsp4DiagnosticStatus, detail: string): DiagnosticCheck {
  return { name, status, detail };
}

export async function buildWsp4Diagnostic(input: {
  stateDir: string;
  actor: SgWorkspaceContext;
  registeredToolNames: readonly string[];
}): Promise<string> {
  const checks: DiagnosticCheck[] = [];
  const profiles = new SgGlobalProfileRegistry(input.stateDir);
  const workspaces = new SgWorkspaceRegistry(input.stateDir);
  const memberships = new SgWorkspaceMembershipRegistry(input.stateDir);
  const expectedTools = ["sg_membership_list", "sg_membership_manage"];
  const missingTools = expectedTools.filter((name) => !input.registeredToolNames.includes(name));
  checks.push(
    check(
      "tool_registration",
      missingTools.length === 0 ? "PASS" : "FAIL",
      missingTools.length === 0 ? `${expectedTools.length}/2` : `missing=${missingTools.join(",")}`,
    ),
  );
  checks.push(
    check(
      "actor_authorization",
      input.actor.projectRole === "monarch" && Boolean(input.actor.globalId) ? "PASS" : "FAIL",
      `role=${input.actor.projectRole},globalId=${input.actor.globalId ?? "none"}`,
    ),
  );
  let profileSnapshot: Awaited<ReturnType<SgGlobalProfileRegistry["snapshot"]>> | undefined;
  try {
    profileSnapshot = await profiles.snapshot();
    checks.push(
      check(
        "profile_store",
        "PASS",
        `v=${profileSnapshot.version},profiles=${profileSnapshot.profiles.length}`,
      ),
    );
  } catch (error) {
    checks.push(
      check("profile_store", "FAIL", error instanceof Error ? error.message : String(error)),
    );
  }

  let membershipSnapshot:
    | Awaited<ReturnType<SgWorkspaceMembershipRegistry["snapshot"]>>
    | undefined;
  try {
    const [workspaceList, snapshot] = await Promise.all([
      workspaces.list(),
      memberships.snapshot(),
    ]);
    membershipSnapshot = snapshot;
    checks.push(check("workspace_store", "PASS", `workspaces=${workspaceList.length}`));
    checks.push(
      check(
        "membership_store",
        "PASS",
        `memberships=${snapshot.memberships.length},audit=${snapshot.audit.length}`,
      ),
    );
    const workspaceIds = new Set(workspaceList.map((workspace) => workspace.workspaceId));
    const profileIds = new Set(profileSnapshot?.profiles.map((profile) => profile.globalId) ?? []);
    const auditByOperation = new Map(snapshot.audit.map((event) => [event.operationId, event]));
    const broken = snapshot.memberships.filter((membership) => {
      const event = auditByOperation.get(membership.operationId);
      return (
        !workspaceIds.has(membership.workspaceId) ||
        !profileIds.has(membership.globalId) ||
        !event ||
        event.workspaceId !== membership.workspaceId ||
        event.targetGlobalId !== membership.globalId ||
        (membership.status === "active" && event.action !== "grant") ||
        (membership.status === "revoked" && event.action !== "revoke")
      );
    });
    checks.push(
      check(
        "membership_chain",
        broken.length > 0 ? "FAIL" : snapshot.memberships.length > 0 ? "PASS" : "NOT_EXERCISED",
        broken.length > 0
          ? `broken=${broken.map((item) => item.membershipId).join(",")}`
          : `verified=${snapshot.memberships.length}`,
      ),
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    checks.push(check("workspace_store", "FAIL", detail));
    checks.push(check("membership_store", "FAIL", detail));
    checks.push(check("membership_chain", "FAIL", "membership-store-unreadable"));
  }

  if (input.actor.channel && input.actor.resourceId) {
    try {
      const workspace = await workspaces.resolve({
        platform: input.actor.channel,
        ...(input.actor.accountId ? { accountId: input.actor.accountId } : {}),
        resourceId: input.actor.resourceId,
        ...(input.actor.topicId ? { topicId: input.actor.topicId } : {}),
      });
      checks.push(
        check(
          "current_workspace",
          workspace ? "PASS" : "NOT_EXERCISED",
          workspace ? `id=${workspace.workspaceId},status=${workspace.status}` : "not-registered",
        ),
      );
      if (workspace && input.actor.globalId) {
        const role = await memberships.effectiveRole(workspace.workspaceId, input.actor.globalId);
        checks.push(
          check(
            "current_membership",
            role ? "PASS" : "NOT_EXERCISED",
            `globalId=${input.actor.globalId},role=${role ?? "none"}`,
          ),
        );
      }
    } catch (error) {
      checks.push(
        check("current_workspace", "FAIL", error instanceof Error ? error.message : String(error)),
      );
    }
  } else {
    checks.push(check("current_workspace", "NOT_EXERCISED", "route-has-no-resource"));
  }

  checks.push(
    check(
      "channel_membership_events",
      "NOT_EXERCISED",
      "native-plugin-seam-unavailable; manual-grant-revoke-active",
    ),
  );
  const overall = checks.some((item) => item.status === "FAIL") ? "FAIL" : "PASS";
  return [
    `WSP4 DIAG — ${overall}`,
    ...checks.map((item) => `${item.name}: ${item.status} (${item.detail})`),
    `summary: pass=${checks.filter((item) => item.status === "PASS").length}, fail=${checks.filter((item) => item.status === "FAIL").length}, not_exercised=${checks.filter((item) => item.status === "NOT_EXERCISED").length}`,
    `membership_rows_seen: ${membershipSnapshot?.memberships.length ?? "unknown"}`,
  ].join("\n");
}
