import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildWsp5Diagnostic } from "./wsp5-diagnostics.js";

const toolNames = [
  "sg_content_draft",
  "sg_content_review",
  "sg_content_publish",
  "sg_content_schedule",
  "sg_content_dispatch",
] as const;
const actor = {
  channel: "telegram",
  resourceId: "telegram:100",
  senderId: "100",
  canonicalIdentity: "channel:telegram:100",
  globalId: "usr_monarch",
  projectRole: "monarch" as const,
};

async function diagnosticRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-wsp5-diag-"));
  await mkdir(path.join(root, "sg"), { recursive: true });
  await writeFile(
    path.join(root, "sg", "global-profiles.json"),
    JSON.stringify({
      version: 3,
      profiles: [
        {
          globalId: "usr_monarch",
          canonicalIdentity: "channel:telegram:100",
          role: "monarch",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      identities: [
        {
          canonicalIdentity: "channel:telegram:100",
          globalId: "usr_monarch",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      citizenRequests: [],
      audit: [],
    }),
  );
  return root;
}

describe("SG Workspace Manager WSP5 diagnostics", () => {
  it("passes the complete registered chain before live publication is exercised", async () => {
    const result = await buildWsp5Diagnostic({
      stateDir: await diagnosticRoot(),
      actor,
      registeredToolNames: toolNames,
      lifecycle: { pending: 0, queued: 0, blocked: 0, succeeded: 0, failed: 0 },
    });
    expect(result).toContain("WSP5 DIAG — PASS");
    expect(result).toContain("tool_registration: PASS (5/5)");
    expect(result).toContain("native_message_path: PASS");
    expect(result).toContain("native_automation_path: PASS");
    expect(result).toContain("native_lifecycle: NOT_EXERCISED");
  });

  it("fails on a corrupt durable content store", async () => {
    const root = await diagnosticRoot();
    await writeFile(path.join(root, "sg", "content.json"), '{"version":1,"drafts":"broken"}');
    const result = await buildWsp5Diagnostic({
      stateDir: root,
      actor,
      registeredToolNames: toolNames,
      lifecycle: { pending: 0, queued: 0, blocked: 0, succeeded: 0, failed: 0 },
    });
    expect(result).toContain("WSP5 DIAG — FAIL");
    expect(result).toContain("content_store: FAIL (sg-content-store-invalid)");
  });
});
