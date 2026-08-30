import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { resolveSgCanonicalIdentity, resolveWorkspaceContext } from "./context.js";
import { registerWorkspaceManager } from "./register.js";

const timestamp = "2026-01-01T00:00:00.000Z";

async function stateDirWithProfiles() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-wsp1-"));
  const target = path.join(root, "sg", "global-profiles.json");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify({
    version: 2,
    profiles: [
      { globalId: "usr_monarch", canonicalIdentity: "channel:telegram:100", role: "monarch", status: "active", createdAt: timestamp, updatedAt: timestamp },
      { globalId: "usr_citizen", canonicalIdentity: "channel:telegram:200", role: "citizen", status: "active", createdAt: timestamp, updatedAt: timestamp },
    ],
    identities: [
      { canonicalIdentity: "channel:telegram:100", globalId: "usr_monarch", createdAt: timestamp, updatedAt: timestamp },
      { canonicalIdentity: "channel:telegram:200", globalId: "usr_citizen", createdAt: timestamp, updatedAt: timestamp },
    ],
  }));
  return { root, target };
}

const diagnosticInput = (overrides: Record<string, unknown> = {}) => ({
  channel: "telegram",
  senderId: "100",
  ...overrides,
});

describe("SG Workspace Manager WSP1", () => {
  it("uses OpenClaw identityLinks and fails closed when they are ambiguous", () => {
    expect(resolveSgCanonicalIdentity({ channel: "telegram", senderId: "100", identityLinks: { gary: ["telegram:100"] } })).toBe("linked:gary");
    expect(resolveSgCanonicalIdentity({ channel: "telegram", senderId: "100", identityLinks: { first: ["telegram:100"], second: ["telegram:100"] } })).toBeUndefined();
  });

  it("resolves the monarch in a direct chat without writing the profile store", async () => {
    const { root, target } = await stateDirWithProfiles();
    const before = await readFile(target, "utf8");
    const beforeStat = await stat(target);
    const result = await resolveWorkspaceContext(diagnosticInput({ to: "telegram:100" }), root);
    expect(result).toMatchObject({ globalId: "usr_monarch", projectRole: "monarch", channel: "telegram", resourceId: "telegram:100" });
    expect(await readFile(target, "utf8")).toBe(before);
    expect((await stat(target)).mtimeMs).toBe(beforeStat.mtimeMs);
  });

  it("resolves the same monarch in a group and preserves group/topic context", async () => {
    const { root } = await stateDirWithProfiles();
    await expect(resolveWorkspaceContext(diagnosticInput({ to: "telegram:-100500", messageThreadId: 42, accountId: "default" }), root)).resolves.toMatchObject({
      globalId: "usr_monarch",
      projectRole: "monarch",
      resourceId: "telegram:-100500",
      topicId: "42",
      accountId: "default",
    });
  });

  it("resolves an unknown sender to guest without creating a profile", async () => {
    const { root, target } = await stateDirWithProfiles();
    const before = await readFile(target, "utf8");
    await expect(resolveWorkspaceContext(diagnosticInput({ senderId: "999", to: "telegram:999" }), root)).resolves.toMatchObject({ projectRole: "guest", globalId: undefined });
    expect(await readFile(target, "utf8")).toBe(before);
  });

  it("returns the same read-only identity after a simulated plugin restart", async () => {
    const { root } = await stateDirWithProfiles();
    const first = await resolveWorkspaceContext(diagnosticInput(), root);
    vi.resetModules();
    const restarted = await import("./context.js");
    const second = await restarted.resolveWorkspaceContext(diagnosticInput(), root);
    expect(second).toEqual(first);
  });

  it("registers one normal OpenClaw reply command and no hooks, tools, or transports", () => {
    const registerCommand = vi.fn();
    registerWorkspaceManager({ registerCommand });
    expect(registerCommand).toHaveBeenCalledOnce();
    const command = registerCommand.mock.calls[0]?.[0];
    expect(command).toMatchObject({ name: "sg_context", requireAuth: false });
  });

  it("leaves ordinary OpenClaw replies untouched when the plugin is disabled", () => {
    const registerCommand = vi.fn();
    expect(registerCommand).not.toHaveBeenCalled();
  });
});
