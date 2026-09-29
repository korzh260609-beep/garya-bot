import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFile(path, "utf8");

describe("SG project development workflow contract", () => {
  it("keeps universal repository access, defaults, evidence and authority boundaries explicit", async () => {
    const [agents, skill, github] = await Promise.all([
      read("sg/workspace/AGENTS.md"),
      read("sg/workspace/skills/sg-project-operations/SKILL.md"),
      read("sg/workspace/skills/sg-project-operations/references/github.md"),
    ]);

    expect(agents).toContain("## Project development workflow");
    expect(agents).toContain("sg-project-operations");
    expect(agents).not.toContain("sh /app/scripts/sg22-project-repo.sh");
    expect(skill).toContain("references/github.md");
    expect(skill).toContain("references/render.md");
    expect(github).toContain("korzh260609-beep/garya-bot");
    expect(github).toContain("dev/sg2.2-openclaw");
    expect(github).toContain("any repository accessible to the authenticated GitHub account");
    expect(github).toContain("any existing branch");
    expect(github).toContain("defaults, not an allowlist");
    expect(github).toContain(
      "do not introduce repository or branch allowlists without separate owner approval",
    );
    expect(github).toContain("Never modify `main`.");
    expect(github).toContain("sh /app/scripts/sg22-project-repo.sh");
    expect(github).toContain("/data/workspace/github/<owner>/<repository>");
    expect(github).toContain(
      "Never reset, clean, stash, overwrite, delete, or switch branches automatically.",
    );
    expect(github).toContain(
      "Use the currently available and authorized native connection for each source",
    );
    expect(github).toContain(
      "Treat investigation, file changes, commit/push, and deployment as separate authority boundaries.",
    );
    expect(github).toContain(
      "Creating a commit and pushing it require separate explicit authorization.",
    );
    expect(github).toContain("A dirty tree before commit and an ahead branch before push");
  });

  it("requires minimal evidence-based changes and complete delivery verification", async () => {
    const [github, render, overlay, entrypoint] = await Promise.all([
      read("sg/workspace/skills/sg-project-operations/references/github.md"),
      read("sg/workspace/skills/sg-project-operations/references/render.md"),
      read("Dockerfile.sg22-overlay"),
      read("scripts/sg22-render-entrypoint.sh"),
    ]);

    expect(github).toContain("Diagnose from evidence.");
    expect(github).toContain("Propose the smallest sufficient change");
    expect(github).toContain("exact remote SHA");
    expect(github).toContain("use GitHub Actions for the complete suite");
    expect(github).toContain("every relevant GitHub Actions job to reach full success");
    expect(render).toContain("verify that the exact image exists");
    expect(render).toContain(
      "Render deploy, restart, rollback, and environment changes each require explicit authorization.",
    );
    expect(render).toContain("Use `sg_render` for Render operations.");
    expect(render).toContain("Telegram connection and probe");
    expect(render).toContain("required workspace files");
    expect(overlay).toContain(
      "COPY --chown=node:node scripts/sg22-project-repo.sh /app/scripts/sg22-project-repo.sh",
    );
    expect(overlay).toContain("/app/scripts/sg22-project-repo.sh");
    expect(entrypoint).toContain('cp "$skill_source/$file" "$skill_target/$file"');
  });

  it("prevents unapproved architecture rewrites and parallel systems", async () => {
    const agents = await read("sg/workspace/AGENTS.md");

    expect(agents).toContain("## Architecture preservation gate");
    expect(agents).toContain("Do not modify OpenClaw core or the native Telegram adapter unless");
    expect(agents).toContain(
      "Do not replace or duplicate native OpenClaw identity, sessions, access control, messages, memory, automations, delivery routing, browser, repository access, or Telegram behavior.",
    );
    expect(agents).toContain(
      "Do not create a parallel scheduler, delivery router, Telegram adapter, memory system, repository layer, task engine, or other competing subsystem.",
    );
    expect(agents).toContain(
      "A failure in one task, prompt, route, test, or configuration is not evidence that the whole architecture must be rewritten.",
    );
    expect(agents).toContain("When evidence does not meet this gate, preserve the architecture");
  });
});
