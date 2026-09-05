import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SgGlobalProfileRegistry } from "./citizenship-registry.js";
import { buildWsp4Diagnostic } from "./wsp4-diagnostics.js";

const timestamp = "2026-01-01T00:00:00.000Z";
const tools = ["sg_membership_list", "sg_membership_manage"];

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-wsp4-diag-"));
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
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      identities: [
        {
          canonicalIdentity: "channel:telegram:100",
          globalId: "usr_monarch",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      citizenRequests: [],
      audit: [],
    }),
  );
  return root;
}

describe("SG WSP4 authoritative diagnostics", () => {
  it("uses PASS/NOT_EXERCISED and never treats untouched branches as observed", async () => {
    const root = await fixture();
    const text = await buildWsp4Diagnostic({
      stateDir: root,
      actor: {
        channel: "telegram",
        senderId: "100",
        canonicalIdentity: "channel:telegram:100",
        globalId: "usr_monarch",
        projectRole: "monarch",
      },
      registeredToolNames: tools,
    });
    expect(text).toContain("WSP4 DIAG — PASS");
    expect(text).toContain("tool_registration: PASS");
    expect(text).toContain("profile_store: PASS (v=5,profiles=1)");
    expect(text).toContain("membership_chain: NOT_EXERCISED");
    expect(text).toContain("channel_membership_events: NOT_EXERCISED");
    expect((await new SgGlobalProfileRegistry(root).snapshot()).profiles).toHaveLength(1);
  });

  it("reports exact authoritative store failure", async () => {
    const root = await fixture();
    await writeFile(path.join(root, "sg", "workspace-memberships.json"), "{}");
    const text = await buildWsp4Diagnostic({
      stateDir: root,
      actor: {
        channel: "telegram",
        globalId: "usr_monarch",
        projectRole: "monarch",
      },
      registeredToolNames: tools,
    });
    expect(text).toContain("WSP4 DIAG — FAIL");
    expect(text).toContain("sg-workspace-membership-store-invalid");
  });
});
