import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatWorkspaceContext, type SgWorkspaceContext } from "./context.js";

const repoRoot = path.resolve(".");
const pluginDir = path.join(repoRoot, "sg", "plugin");

describe("SG 2.2 Phase 11 diagnostics and documentation", () => {
  it("reports the canonical identity, personal workspace, resource scope, and native policy outcome", () => {
    const context = {
      channel: "telegram",
      accountId: "default",
      resourceId: "telegram:-100500",
      topicId: "42",
      senderId: "200",
      canonicalIdentity: "channel:telegram:200",
      globalId: "usr_citizen",
      projectRole: "citizen",
      personalWorkspaceId: "usr_citizen",
      personalWorkspaceRoot: "/state/sg/users/usr_citizen",
      resourceScopeId: "rscope_group",
      nativePolicyOutcome: "admitted",
    } as SgWorkspaceContext & {
      resourceScopeId: string;
      nativePolicyOutcome: string;
    };

    const report = formatWorkspaceContext(context);

    expect(report).not.toContain("WSP1 (read-only)");
    expect(report).toMatch(/(?:personal workspace|личн(?:ый|ое) workspace).*usr_citizen/iu);
    expect(report).toMatch(/resource scope.*rscope_group/iu);
    expect(report).toMatch(/(?:native|OpenClaw).*(?:policy|политик).*admitted/iu);
    expect(report).not.toMatch(/guest|application|membership|group[- ]owner/iu);
  });

  it("uses a role-neutral production module name for the Global Profile registry", async () => {
    await expect(access(path.join(pluginDir, "citizenship-registry.ts"))).rejects.toMatchObject({
      code: "ENOENT",
    });

    const productionSources = await Promise.all(
      ["context.ts", "index.ts", "register.ts", "wsp5-diagnostics.ts"].map((file) =>
        readFile(path.join(pluginDir, file), "utf8"),
      ),
    );
    expect(productionSources.join("\n")).not.toContain("citizenship-registry");
  });

  it("records Phases 0-11 as complete and Phase 12 owner handoff as pending", async () => {
    const plan = await readFile(
      path.join(repoRoot, "pillars", "roadmap", "SG22_ROLE_MODEL_MIGRATION_PLAN.md"),
      "utf8",
    );

    expect(plan).not.toContain("NOT YET IMPLEMENTED");
    expect(plan).toMatch(/Phases? 0[–-]11[^\n]*(?:complete|completed|выполнены)/iu);
    expect(plan).toMatch(/Phase 12[^\n]*local verification passed/iu);
    expect(plan).toMatch(/Immediate next action[\s\S]{0,500}exact Phase 12 commit/iu);
    expect(plan).toMatch(/Phase 12 remains open/iu);
  });

  it("marks documents that retain the obsolete role model as historical", async () => {
    const historicalDocuments = [
      "SG22_WORKSPACE_COMMUNITY_PLUGIN.md",
      "SG22_IDENTITY_GLOBAL_PROFILE_INTEGRATION.md",
    ];

    for (const file of historicalDocuments) {
      const source = await readFile(path.join(repoRoot, "pillars", "roadmap", file), "utf8");
      const header = source.split("\n").slice(0, 14).join("\n");
      expect(header, file).toMatch(/HISTORICAL|SUPERSEDED/u);
    }
  });
});
