import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { drainFileLockStateForTest, resetFileLockStateForTest } from "../infra/file-lock.js";
import {
  buildSgIdentityContext,
  resolveSgCanonicalIdentity,
  resolveSgGlobalProfile,
  updateSgGlobalProfile,
} from "./global-profile.js";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sg-global-profile-"));
  return path.join(root, "profiles.json");
}

afterEach(async () => {
  await drainFileLockStateForTest();
  resetFileLockStateForTest();
});

describe("SG global profile", () => {
  it("uses OpenClaw identity links across channels and separates unlinked identities", () => {
    const identityLinks = {
      monarch: ["telegram:100", "discord:200"],
    };
    expect(
      resolveSgCanonicalIdentity({ channel: "telegram", senderId: "100", identityLinks }),
    ).toBe("linked:monarch");
    expect(
      resolveSgCanonicalIdentity({ channel: "discord", senderId: "200", identityLinks }),
    ).toBe("linked:monarch");
    expect(resolveSgCanonicalIdentity({ channel: "telegram", senderId: "300" })).toBe(
      "channel:telegram:300",
    );
    expect(resolveSgCanonicalIdentity({ channel: "discord", senderId: "300" })).toBe(
      "channel:discord:300",
    );
    expect(
      resolveSgCanonicalIdentity({
        channel: "telegram",
        senderId: "100",
        identityLinks: { first: ["telegram:100"], second: ["telegram:100"] },
      }),
    ).toBeNull();
  });

  it("returns one durable Global ID for repeated and concurrent first contact", async () => {
    const storePath = await fixture();
    const profiles = await Promise.all(
      Array.from({ length: 12 }, () =>
        resolveSgGlobalProfile({ canonicalIdentity: "linked:gary", storePath }),
      ),
    );
    expect(new Set(profiles.map((profile) => profile.globalId)).size).toBe(1);
    const persisted = JSON.parse(await readFile(storePath, "utf8")) as { profiles: unknown[] };
    expect(persisted.profiles).toHaveLength(1);
    const afterRestart = await resolveSgGlobalProfile({
      canonicalIdentity: "linked:gary",
      storePath,
    });
    expect(afterRestart.globalId).toBe(profiles[0].globalId);
  });

  it("creates distinct profiles and exposes role without granting permission", async () => {
    const storePath = await fixture();
    const first = await resolveSgGlobalProfile({ canonicalIdentity: "channel:web:a", storePath });
    const second = await resolveSgGlobalProfile({ canonicalIdentity: "channel:web:b", storePath });
    expect(first.globalId).not.toBe(second.globalId);
    expect(buildSgIdentityContext(first)).toMatchObject({
      globalId: first.globalId,
      role: "guest",
      accessGroup: "sg-guest",
    });
  });

  it("allows controlled role and status transitions and rejects unauthorized updates", async () => {
    const storePath = await fixture();
    const profile = await resolveSgGlobalProfile({ canonicalIdentity: "linked:owner", storePath });
    await expect(
      updateSgGlobalProfile({
        globalId: profile.globalId,
        role: "monarch",
        authorize: () => false,
        storePath,
      }),
    ).rejects.toThrow("sg-global-profile-update-denied");
    const updated = await updateSgGlobalProfile({
      globalId: profile.globalId,
      role: "citizen",
      status: "suspended",
      authorize: () => true,
      storePath,
    });
    expect(updated).toMatchObject({ role: "citizen", status: "suspended" });
    expect(updated.canonicalIdentity).toBe(profile.canonicalIdentity);
    const monarch = await updateSgGlobalProfile({
      globalId: profile.globalId,
      role: "monarch",
      status: "active",
      authorize: () => true,
      storePath,
    });
    expect(buildSgIdentityContext(monarch)).toMatchObject({
      role: "monarch",
      accessGroup: "sg-monarch",
    });
  });
});
