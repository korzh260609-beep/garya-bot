import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildSgPrompt, decideSgRegistration, listPendingSgRegistrations, requestSgRegistration, resolveSgCanonicalIdentity, resolveSgProfile } from "./index.js";

describe("SG Global Identity plugin", () => {
  it("uses one canonical identity across linked transports", () => {
    const identityLinks = { gary: ["telegram:100", "discord:200"] };
    expect(resolveSgCanonicalIdentity({ channel: "telegram", senderId: "100", identityLinks })).toBe("linked:gary");
    expect(resolveSgCanonicalIdentity({ channel: "discord", senderId: "200", identityLinks })).toBe("linked:gary");
    expect(resolveSgCanonicalIdentity({ channel: "telegram", senderId: "300" })).toBe("channel:telegram:300");
    expect(resolveSgCanonicalIdentity({ channel: "discord", senderId: "300" })).toBe("channel:discord:300");
  });

  it("fails closed for ambiguous OpenClaw identity links", () => {
    expect(resolveSgCanonicalIdentity({ channel: "telegram", senderId: "100", identityLinks: { first: ["telegram:100"], second: ["telegram:100"] } })).toBeUndefined();
  });

  it("keeps one durable Global ID for repeated contact", async () => {
    const stateDir = await mkdtemp(path.join(os.tmpdir(), "sg-identity-"));
    const first = await resolveSgProfile("channel:web:user-1", stateDir);
    const second = await resolveSgProfile("channel:web:user-1", stateDir);
    expect(second?.globalId).toBe(first?.globalId);
    const store = JSON.parse(await readFile(path.join(stateDir, "sg", "global-profiles.json"), "utf8")) as { profiles: unknown[]; identities: unknown[] };
    expect(store.profiles).toHaveLength(1);
    expect(store.identities).toHaveLength(1);
  });

  it("injects only active verified roles and never trusts transport display text", async () => {
    const stateDir = await mkdtemp(path.join(os.tmpdir(), "sg-identity-"));
    const storePath = path.join(stateDir, "sg", "global-profiles.json");
    await mkdir(path.dirname(storePath), { recursive: true });
    await writeFile(storePath, JSON.stringify({ version: 2, profiles: [{ globalId: "usr_monarch", canonicalIdentity: "channel:telegram:100", role: "monarch", status: "active", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }], identities: [{ canonicalIdentity: "channel:telegram:100", globalId: "usr_monarch", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }] }));
    const profile = await resolveSgProfile("channel:telegram:100", stateDir);
    const prompt = profile ? buildSgPrompt(profile) : undefined;
    expect(prompt).toContain("sg.globalId: usr_monarch");
    expect(prompt).toContain("sg.role: monarch");
    expect(prompt).not.toContain("Корж Игорь");
    expect(profile ? buildSgPrompt({ ...profile, status: "suspended" }) : undefined).toBeUndefined();
  });

  it("binds host-verified owner to the canonical monarch Global ID", async () => {
    const stateDir = await mkdtemp(path.join(os.tmpdir(), "sg-identity-"));
    process.env.SG_MONARCH_GLOBAL_USER_ID = "usr_monarch";
    try {
      const profile = await resolveSgProfile("channel:telegram:100", stateDir, { senderIsOwner: true });
      expect(profile).toMatchObject({ globalId: "usr_monarch", role: "monarch" });
      const repeated = await resolveSgProfile("channel:telegram:100", stateDir);
      expect(repeated?.globalId).toBe("usr_monarch");
    } finally {
      delete process.env.SG_MONARCH_GLOBAL_USER_ID;
    }
  });

  it("keeps guests restricted until the monarch approves their registration", async () => {
    const stateDir = await mkdtemp(path.join(os.tmpdir(), "sg-identity-"));
    const guest = await resolveSgProfile("channel:telegram:200", stateDir);
    expect(guest?.role).toBe("guest");
    expect(await requestSgRegistration(guest!, "telegram", "200", stateDir)).toBe(true);
    expect(await requestSgRegistration(guest!, "telegram", "200", stateDir)).toBe(false);
    expect(await listPendingSgRegistrations(stateDir)).toHaveLength(1);
    const citizen = await decideSgRegistration(guest!.globalId, "approve", "usr_monarch", stateDir);
    expect(citizen?.role).toBe("citizen");
    expect(await listPendingSgRegistrations(stateDir)).toHaveLength(0);
  });

  it("marks guest access as information-only in verified context", async () => {
    const stateDir = await mkdtemp(path.join(os.tmpdir(), "sg-identity-"));
    const guest = await resolveSgProfile("channel:telegram:300", stateDir);
    expect(buildSgPrompt(guest!)).toContain("access.mode: information_only");
  });
});
