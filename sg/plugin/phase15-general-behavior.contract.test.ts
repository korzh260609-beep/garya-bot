import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadWorkspaceBootstrapFiles } from "../../src/agents/workspace.js";

const readAgents = () => readFile("sg/workspace/AGENTS.md", "utf8");

describe("SG general behavior contract", () => {
  it("defines one complete behavior loop grounded in SG identity and Project SG", async () => {
    const agents = await readAgents();

    expect(agents).toContain("## General behavior algorithm");
    for (const step of [
      "### 1. Establish identity, context, and outcome",
      "### 2. Classify the request",
      "### 3. Recover relevant context and memory",
      "### 4. Decide whether clarification is required",
      "### 5. Analyze and recommend",
      "### 6. Select the authoritative native capability",
      "### 7. Check authority, risk, and reversibility",
      "### 8. Choose and perform the permitted response",
      "### 9. Verify the outcome",
      "### 10. Recover honestly from failure",
      "### 11. Report the result",
      "### 12. Preserve durable experience",
    ]) {
      expect(agents).toContain(step);
    }

    expect(agents).toContain("This algorithm applies the SG entity and Project SG");
    expect(agents).toContain(
      "The same SG entity and governing behavior apply in every permitted channel",
    );
  });

  it("distinguishes task modes and keeps action inside granted authority", async () => {
    const agents = await readAgents();

    for (const mode of [
      "ordinary question or explanation",
      "current-fact research",
      "audit or diagnosis",
      "planning",
      "artifact creation",
      "local mutation",
      "external or consequential action",
      "monitoring or waiting",
    ]) {
      expect(agents).toContain(mode);
    }

    expect(agents).toContain("Capability never implies authorization.");
    expect(agents).toContain("Do not turn an audit into a mutation");
    expect(agents).toContain("Do not add unrequested cleanup, refactoring, or improvements.");
    expect(agents).toContain(
      "Project SG repository work delegates to the Project development workflow below.",
    );
  });

  it("requires source-aware verification, visible failures, and precise reporting", async () => {
    const agents = await readAgents();

    expect(agents).toContain(
      "Current authoritative evidence overrides conflicting or stale memory.",
    );
    expect(agents).toContain("Never label an unverified result as complete or successful.");
    expect(agents).toContain("Do not hide partial completion or silently abandon the task.");
    expect(agents).toContain(
      "confirmed facts, remembered context, inferences, proposals, completed actions, and unverified items",
    );
    expect(agents).toContain("Persist only durable, useful, permitted knowledge");
    expect(agents).toContain(
      "Never persist credentials, secrets, transient logs, or unsupported assumptions",
    );
  });

  it("is loaded through the native OpenClaw workspace bootstrap boundary", async () => {
    const expected = await readAgents();
    const bootstrapFiles = await loadWorkspaceBootstrapFiles("sg/workspace");
    const agents = bootstrapFiles.find((file) => file.name === "AGENTS.md");
    const injectedCharacters = bootstrapFiles.reduce(
      (total, file) => total + (file.content?.length ?? 0),
      0,
    );

    expect(agents).toMatchObject({ missing: false });
    expect(agents?.content).toBe(expected);
    expect(expected.length).toBeLessThanOrEqual(20_000);
    expect(injectedCharacters).toBeLessThanOrEqual(60_000);
  });
});
