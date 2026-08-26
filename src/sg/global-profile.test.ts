import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { drainFileLockStateForTest, resetFileLockStateForTest } from "../infra/file-lock.js";
import {
  buildSgIdentityContext,
  resolveSgCanonicalIdentity,
  resolveSgGlobalProfile,
  resolveSgIdentityContext,
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
    const persisted = JSON.parse(await readFile(storePath, "utf8")) as {
      version: number;
      profiles: unknown[];
      identities: unknown[];
    };
    expect(persisted.version).toBe(2);
    expect(persisted.profiles).toHaveLength(1);
    expect(persisted.identities).toHaveLength(1);
    const afterRestart = await resolveSgGlobalProfile({
      canonicalIdentity: "linked:gary",
      storePath,
    });
    expect(afterRestart.globalId).toBe(profiles[0].globalId);
  });

  it("recovers compatible legacy profile stores instead of aborting dispatch", async () => {
    const storePath = await fixture();
    await writeFile(
      storePath,
      JSON.stringify({
        "channel:telegram:100": {
          globalId: "usr_existing",
          role: "monarch",
        },
      }),
      "utf8",
    );
    const profile = await resolveSgGlobalProfile({
      canonicalIdentity: "channel:telegram:100",
      storePath,
    });
    expect(profile).toMatchObject({
      globalId: "usr_existing",
      canonicalIdentity: "channel:telegram:100",
      role: "monarch",
      status: "active",
    });
  });

  it("still rejects ambiguous or corrupt stores", async () => {
    const storePath = await fixture();
    await writeFile(
      storePath,
      JSON.stringify({
        version: 2,
        profiles: [
          {
            globalId: "usr_dup",
            canonicalIdentity: "channel:telegram:1",
            role: "guest",
            status: "active",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        identities: [
          {
            canonicalIdentity: "channel:telegram:1",
            globalId: "usr_dup",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            canonicalIdentity: "channel:telegram:1",
            globalId: "usr_dup",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
      "utf8",
    );
    await expect(
      resolveSgGlobalProfile({ canonicalIdentity: "channel:telegram:1", storePath }),
    ).rejects.toThrow("sg-global-profile-store-invalid");
  });

  it("creates distinct Global IDs for distinct users", async () => {
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

  it("links multiple transports to one Global ID when OpenClaw identity links resolve the same person", async () => {
    const storePath = await fixture();
    const identityLinks = { gary: ["telegram:100", "discord:200"] };
    const telegram = await resolveSgIdentityContext({
      channel: "telegram",
      senderId: "100",
      identityLinks,
      storePath,
    });
    const discord = await resolveSgIdentityContext({
      channel: "discord",
      senderId: "200",
      identityLinks,
      storePath,
    });
    expect(telegram?.globalId).toBe(discord?.globalId);
    const persisted = JSON.parse(await readFile(storePath, "utf8")) as {
      profiles: unknown[];
      identities: unknown[];
    };
    expect(persisted.profiles).toHaveLength(1);
    expect(persisted.identities).toHaveLength(1);
  });

  it("binds the configured Telegram monarch to the configured monarch Global ID", async () => {
    const storePath = await fixture();
    await resolveSgGlobalProfile({
      canonicalIdentity: "channel:telegram:677128443",
      storePath,
    });
    const context = await resolveSgIdentityContext({
      channel: "telegram",
      senderId: "677128443",
      env: {
        SG_MONARCH_GLOBAL_USER_ID: "usr_monarch",
        SG_MONARCH_TELEGRAM_USER_ID: "677128443",
      },
      storePath,
    });
    expect(context).toMatchObject({
      globalId: "usr_monarch",
      role: "monarch",
      accessGroup: "sg-monarch",
    });
    const persisted = JSON.parse(await readFile(storePath, "utf8")) as {
      profiles: Array<{ globalId: string; role: string }>;
      identities: Array<{ globalId: string; canonicalIdentity: string }>;
    };
    expect(persisted.profiles).toEqual([
      expect.objectContaining({ globalId: "usr_monarch", role: "monarch" }),
    ]);
    expect(persisted.identities).toEqual([
      expect.objectContaining({
        globalId: "usr_monarch",
        canonicalIdentity: "channel:telegram:677128443",
      }),
    ]);
  });

  it("does not classify arbitrary Telegram users as monarch from Global ID config alone", async () => {
    const storePath = await fixture();
    const context = await resolveSgIdentityContext({
      channel: "telegram",
      senderId: "999",
      env: { SG_MONARCH_GLOBAL_USER_ID: "usr_monarch" },
      storePath,
    });
    expect(context?.role).toBe("guest");
    expect(context?.globalId).not.toBe("usr_monarch");
  });

  it("requires the monarch Global ID when a monarch Telegram identity is configured", async () => {
    const storePath = await fixture();
    await expect(
      resolveSgIdentityContext({
        channel: "telegram",
        senderId: "100",
        env: { SG_MONARCH_TELEGRAM_USER_ID: "100" },
        storePath,
      }),
    ).rejects.toThrow("SG_MONARCH_GLOBAL_USER_ID is required");
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
