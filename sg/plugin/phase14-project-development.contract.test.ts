import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFile(path, "utf8");

describe("SG project development workflow contract", () => {
  it("keeps repository, branch, evidence and authority boundaries explicit", async () => {
    const agents = await read("sg/workspace/AGENTS.md");

    expect(agents).toContain("## Project development workflow");
    expect(agents).toContain("korzh260609-beep/garya-bot");
    expect(agents).toContain("dev/sg2.2-openclaw");
    expect(agents).toContain("Never modify `main`.");
    expect(agents).toContain(
      "Use the currently available and authorized native connection for each source",
    );
    expect(agents).toContain(
      "Treat investigation, file changes, commit/push, and deployment as separate authority boundaries.",
    );
    expect(agents).toContain(
      "Creating a commit and pushing it require separate explicit authorization.",
    );
  });

  it("requires minimal evidence-based changes and complete delivery verification", async () => {
    const agents = await read("sg/workspace/AGENTS.md");

    expect(agents).toContain("Diagnose from evidence.");
    expect(agents).toContain("Propose the smallest sufficient change");
    expect(agents).toContain("exact remote SHA");
    expect(agents).toContain("every relevant GitHub Actions job to reach full success");
    expect(agents).toContain("verify that the exact image exists");
    expect(agents).toContain(
      "Render deploy, restart, rollback, and environment changes each require explicit authorization.",
    );
    expect(agents).toContain("Use `sg_render` for Render operations.");
    expect(agents).toContain("Telegram connection and probe");
    expect(agents).toContain("required workspace files");
  });

  it("prevents unapproved architecture rewrites and parallel systems", async () => {
    const agents = await read("sg/workspace/AGENTS.md");

    expect(agents).toContain("## Architecture preservation gate");
    expect(agents).toContain(
      "Do not modify OpenClaw core or the native Telegram adapter unless",
    );
    expect(agents).toContain(
      "Do not replace or duplicate native OpenClaw identity, sessions, access control, messages, memory, automations, delivery routing, browser, repository access, or Telegram behavior.",
    );
    expect(agents).toContain(
      "Do not create a parallel scheduler, delivery router, Telegram adapter, memory system, repository layer, task engine, or other competing subsystem.",
    );
    expect(agents).toContain(
      "A failure in one task, prompt, route, test, or configuration is not evidence that the whole architecture must be rewritten.",
    );
    expect(agents).toContain(
      "When evidence does not meet this gate, preserve the architecture",
    );
  });
});
