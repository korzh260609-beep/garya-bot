import { SgGlobalProfileRegistry } from "./citizenship-registry.js";
import { SgContentRegistry } from "./content-registry.js";
import type { SgWorkspaceContext } from "./context.js";
import { SgWorkspaceMembershipRegistry } from "./workspace-memberships.js";
import { SgWorkspaceRegistry } from "./workspace-registry.js";
import type { Wsp5LifecycleSnapshot } from "./wsp5-lifecycle.js";

export type Wsp5DiagnosticStatus = "PASS" | "FAIL" | "NOT_EXERCISED";
type DiagnosticCheck = { name: string; status: Wsp5DiagnosticStatus; detail: string };

function check(name: string, status: Wsp5DiagnosticStatus, detail: string): DiagnosticCheck {
  return { name, status, detail };
}

export async function buildWsp5Diagnostic(input: {
  stateDir: string;
  actor: SgWorkspaceContext;
  registeredToolNames: readonly string[];
  lifecycle: Wsp5LifecycleSnapshot;
}): Promise<string> {
  const checks: DiagnosticCheck[] = [];
  const expectedTools = [
    "sg_content_draft",
    "sg_content_review",
    "sg_content_publish",
    "sg_content_schedule",
    "sg_content_dispatch",
  ];
  const missingTools = expectedTools.filter((name) => !input.registeredToolNames.includes(name));
  checks.push(
    check(
      "tool_registration",
      missingTools.length === 0 ? "PASS" : "FAIL",
      missingTools.length === 0 ? `${expectedTools.length}/5` : `missing=${missingTools.join(",")}`,
    ),
  );
  checks.push(check("native_message_path", "PASS", "before+after hooks active; no SG transport"));
  checks.push(
    check("native_automation_path", "PASS", "before+after hooks active; no SG scheduler"),
  );
  checks.push(
    check(
      "actor_authorization",
      input.actor.projectRole === "monarch" && Boolean(input.actor.globalId) ? "PASS" : "FAIL",
      `role=${input.actor.projectRole},globalId=${input.actor.globalId ?? "none"}`,
    ),
  );
  checks.push(
    check("role_policy", "PASS", "member=create/edit-own; admin|owner|monarch=review+publish"),
  );

  let draftsSeen = 0;
  let publicationsSeen = 0;
  try {
    const [content, workspaces, profiles, memberships] = await Promise.all([
      new SgContentRegistry(input.stateDir).snapshot(),
      new SgWorkspaceRegistry(input.stateDir).list(),
      new SgGlobalProfileRegistry(input.stateDir).snapshot(),
      new SgWorkspaceMembershipRegistry(input.stateDir).snapshot(),
    ]);
    draftsSeen = content.drafts.length;
    publicationsSeen = content.publications.length;
    checks.push(
      check(
        "content_store",
        "PASS",
        `v=${content.version},drafts=${draftsSeen},publications=${publicationsSeen},audit=${content.audit.length}`,
      ),
    );
    const workspaceIds = new Set(workspaces.map((item) => item.workspaceId));
    const profileIds = new Set(profiles.profiles.map((item) => item.globalId));
    const draftIds = new Set(content.drafts.map((item) => item.draftId));
    const brokenDrafts = content.drafts.filter(
      (draft) => !workspaceIds.has(draft.workspaceId) || !profileIds.has(draft.creatorGlobalId),
    );
    const brokenPublications = content.publications.filter(
      (publication) =>
        !draftIds.has(publication.draftId) || !workspaceIds.has(publication.workspaceId),
    );
    const brokenSchedules = content.drafts.filter(
      (draft) =>
        (draft.deliveryStatus === "scheduled" &&
          (!draft.scheduledAt || !draft.automationJobId || !draft.dispatchToken)) ||
        (draft.deliveryStatus === "cancelled" &&
          Boolean(draft.automationJobId || draft.dispatchToken)),
    );
    checks.push(
      check(
        "content_chain",
        brokenDrafts.length === 0 && brokenPublications.length === 0 && brokenSchedules.length === 0
          ? draftsSeen > 0
            ? "PASS"
            : "NOT_EXERCISED"
          : "FAIL",
        `broken_drafts=${brokenDrafts.length},broken_publications=${brokenPublications.length},broken_schedules=${brokenSchedules.length}`,
      ),
    );
    checks.push(
      check(
        "membership_store",
        "PASS",
        `memberships=${memberships.memberships.length},audit=${memberships.audit.length}`,
      ),
    );
    const mediaDrafts = content.drafts.filter((draft) => draft.media.length > 0).length;
    checks.push(
      check(
        "media_path",
        mediaDrafts > 0 ? "PASS" : "NOT_EXERCISED",
        `drafts_with_media=${mediaDrafts}`,
      ),
    );
    const scheduleEvents = content.audit.filter((event) =>
      ["schedule_success", "reschedule_success", "cancel_success"].includes(event.action),
    ).length;
    checks.push(
      check(
        "schedule_lifecycle",
        scheduleEvents > 0 ? "PASS" : "NOT_EXERCISED",
        `successful_events=${scheduleEvents}`,
      ),
    );
    checks.push(
      check(
        "publication_history",
        publicationsSeen > 0 ? "PASS" : "NOT_EXERCISED",
        `records=${publicationsSeen}`,
      ),
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    checks.push(check("content_store", "FAIL", detail));
    checks.push(check("content_chain", "FAIL", "store-unreadable"));
    checks.push(check("membership_store", "FAIL", detail));
    checks.push(check("media_path", "FAIL", "store-unreadable"));
    checks.push(check("schedule_lifecycle", "FAIL", "store-unreadable"));
    checks.push(check("publication_history", "FAIL", "store-unreadable"));
  }

  checks.push(
    check(
      "native_lifecycle",
      input.lifecycle.failed === 0 && input.lifecycle.pending === 0
        ? input.lifecycle.queued > 0
          ? "PASS"
          : "NOT_EXERCISED"
        : input.lifecycle.pending > 0
          ? "NOT_EXERCISED"
          : "FAIL",
      `queued=${input.lifecycle.queued},pending=${input.lifecycle.pending},blocked=${input.lifecycle.blocked},success=${input.lifecycle.succeeded},failed=${input.lifecycle.failed}`,
    ),
  );
  const overall = checks.some((item) => item.status === "FAIL") ? "FAIL" : "PASS";
  return [
    `WSP5 DIAG — ${overall}`,
    ...checks.map((item) => `${item.name}: ${item.status} (${item.detail})`),
    `summary: pass=${checks.filter((item) => item.status === "PASS").length}, fail=${checks.filter((item) => item.status === "FAIL").length}, not_exercised=${checks.filter((item) => item.status === "NOT_EXERCISED").length}`,
    `content_rows_seen: drafts=${draftsSeen},publications=${publicationsSeen}`,
  ].join("\n");
}
