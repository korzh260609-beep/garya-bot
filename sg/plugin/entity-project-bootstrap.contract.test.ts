import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFile(path, "utf8");

describe("SG project and entity bootstrap contract", () => {
  it("keeps the complete canonical project and entity definition", async () => {
    const [project, entity] = await Promise.all([
      read("pillars/PROJECT.md"),
      read("pillars/entity/SG_ENTITY.md"),
    ]);

    for (const document of [project, entity]) {
      expect(document).toContain("SG is the global project entity and project system.");
      expect(document).toContain(
        "OpenClaw is the authoritative technical platform and runtime beneath SG; it is not SG's identity.",
      );
      expect(document).toContain("User = architect and source of final decisions.");
      expect(document).toContain(
        "SG = advisor + analyst + capability coordinator + risk controller + controlled executor.",
      );
    }

    expect(project).toContain("Kingdom GARYA");
    expect(project).toContain("Meaning-first and source-first");
    expect(project).toContain("Memory and experience");
    expect(entity).toContain("Platform neutrality");
    expect(entity).toContain("Self-description");
  });

  it("projects project meaning into every live workspace instruction layer", async () => {
    const workspaceFiles = await Promise.all([
      read("sg/workspace/IDENTITY.md"),
      read("sg/workspace/SOUL.md"),
      read("sg/workspace/AGENTS.md"),
    ]);

    for (const document of workspaceFiles) {
      expect(document).toContain("global project entity");
      expect(document).toContain("OpenClaw");
      expect(document).toContain("architect");
      expect(document).toContain("controlled");
    }

    expect(workspaceFiles.join("\n")).toContain("Kingdom GARYA");
    expect(workspaceFiles.join("\n")).toContain(
      "meaning -> intent -> context -> capability -> permission -> source/tool -> action/answer",
    );
  });

  it("keeps the current SG 2.2 role and memory model", async () => {
    const [entity, soul, agents] = await Promise.all([
      read("pillars/entity/SG_ENTITY.md"),
      read("sg/workspace/SOUL.md"),
      read("sg/workspace/AGENTS.md"),
    ]);
    const contract = [entity, soul, agents].join("\n");

    expect(contract).toContain("citizen automatically on first contact");
    expect(contract).toContain("guest");
    expect(contract).toContain("deferred");
    expect(contract).toContain("Global ID");
    expect(contract).toContain("different citizens");
    expect(contract).toContain("isolated");
  });

  it("installs all semantic bootstrap files into the persistent workspace", async () => {
    const entrypoint = await read("sg/runtime/entrypoint.sh");

    expect(entrypoint).toContain("IDENTITY.md");
    expect(entrypoint).toContain("SOUL.md");
    expect(entrypoint).toContain("AGENTS.md");
    expect(entrypoint).toContain("/data/workspace");
  });
});
