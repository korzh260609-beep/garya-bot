import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pluginDir = path.resolve("sg", "plugin");

describe("SG 2.2 Phase 9 WSP6 Global ID and resource scope contract", () => {
  it("removes caller-selected scopes and internal SG role gates from WSP6 tools", async () => {
    const tools = await readFile(path.join(pluginDir, "wsp6-tools.ts"), "utf8");

    expect(tools).not.toMatch(/workspaceId\s*:\s*\{\s*type:\s*["']string["']/u);
    expect(tools).not.toMatch(/params\.(?:workspaceId|resourceScopeId|globalId|topicId)/u);
    expect(tools).not.toMatch(/\b(?:projectRole|canManage|requireManager)\b/u);
  });

  it("stores definitions and attempts by personal or resource scope instead of workspaceId", async () => {
    const assessments = await readFile(path.join(pluginDir, "wsp6-assessments.ts"), "utf8");

    expect(assessments).not.toMatch(/\bworkspaceId\b/u);
    expect(assessments).toMatch(/kind:\s*["']personal["'][\s\S]*globalId/u);
    expect(assessments).toMatch(/kind:\s*["']resource["'][\s\S]*resourceScopeId/u);
    expect(assessments).toMatch(
      /attemptSlotKey\([\s\S]*testId:\s*string[\s\S]*globalId:\s*string/u,
    );
  });

  it("binds interactive callbacks to the trusted current scope", async () => {
    const interactive = await readFile(path.join(pluginDir, "wsp6-interactive.ts"), "utf8");

    expect(interactive).not.toMatch(/\bworkspaceId\b/u);
    expect(interactive).not.toMatch(/findById\(definition\.workspaceId\)/u);
    expect(interactive).toMatch(/\bresourceScopeId\b/u);
  });
});
