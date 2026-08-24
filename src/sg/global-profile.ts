import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { normalizeLowercaseStringOrEmpty } from "@openclaw/normalization-core/string-coerce";
import { resolveStateDir } from "../config/paths.js";
import { withFileLock } from "../infra/file-lock.js";
import { readJsonIfExists, writeTextAtomic } from "../infra/json-files.js";
import { resolveLinkedDirectPeerId } from "../routing/session-key.js";

export const SG_ROLES = ["monarch", "citizen", "guest"] as const;
export type SgRole = (typeof SG_ROLES)[number];
export type SgProfileStatus = "active" | "suspended" | "archived";

export type SgGlobalProfile = {
  globalId: string;
  canonicalIdentity: string;
  role: SgRole;
  status: SgProfileStatus;
  createdAt: string;
  updatedAt: string;
};

export type SgIdentityContext = {
  globalId: string;
  role: SgRole;
  profile: SgGlobalProfile;
  /** Domain-to-policy selector only. OpenClaw remains the enforcement owner. */
  accessGroup: `sg-${SgRole}`;
};

type SgProfileStore = { version: 1; profiles: SgGlobalProfile[] };

const STORE_LOCK_OPTIONS = {
  retries: { retries: 100, factor: 1.1, minTimeout: 10, maxTimeout: 100 },
  stale: 30_000,
  staleRecovery: "fail-closed" as const,
};

function profileStorePath(env: NodeJS.ProcessEnv): string {
  return path.join(resolveStateDir(env), "sg", "global-profiles.json");
}

function isRole(value: unknown): value is SgRole {
  return typeof value === "string" && (SG_ROLES as readonly string[]).includes(value);
}

function isProfile(value: unknown): value is SgGlobalProfile {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.globalId === "string" &&
    typeof item.canonicalIdentity === "string" &&
    isRole(item.role) &&
    ["active", "suspended", "archived"].includes(String(item.status)) &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

async function readStore(storePath: string): Promise<SgProfileStore> {
  const value = await readJsonIfExists<unknown>(storePath);
  if (value === undefined) {
    return { version: 1, profiles: [] };
  }
  if (
    !value ||
    typeof value !== "object" ||
    (value as { version?: unknown }).version !== 1 ||
    !Array.isArray((value as { profiles?: unknown }).profiles) ||
    !(value as { profiles: unknown[] }).profiles.every(isProfile)
  ) {
    throw new Error("sg-global-profile-store-invalid");
  }
  return value as SgProfileStore;
}

async function writeStore(storePath: string, store: SgProfileStore): Promise<void> {
  await writeTextAtomic(storePath, JSON.stringify(store, null, 2), {
    mode: 0o600,
    trailingNewline: true,
    tempPrefix: "global-profiles.json",
  });
}

/** Resolves the same canonical direct-peer identity OpenClaw uses for session linking. */
export function resolveSgCanonicalIdentity(params: {
  channel: string;
  senderId: string;
  identityLinks?: Record<string, string[]>;
}): string | null {
  const channel = normalizeLowercaseStringOrEmpty(params.channel);
  const senderId = params.senderId.trim();
  if (!channel || !senderId) {
    return null;
  }
  const identityCandidates = new Set([
    normalizeLowercaseStringOrEmpty(senderId),
    normalizeLowercaseStringOrEmpty(`${channel}:${senderId}`),
  ]);
  const linkedCanonicalNames = Object.entries(params.identityLinks ?? {})
    .filter(([, ids]) =>
      ids.some((id) => identityCandidates.has(normalizeLowercaseStringOrEmpty(id))),
    )
    .map(([canonical]) => normalizeLowercaseStringOrEmpty(canonical))
    .filter(Boolean);
  if (new Set(linkedCanonicalNames).size > 1) {
    return null;
  }
  const linked = resolveLinkedDirectPeerId({
    identityLinks: params.identityLinks,
    channel,
    peerId: senderId,
  });
  if (linked) {
    return `linked:${normalizeLowercaseStringOrEmpty(linked)}`;
  }
  return `channel:${channel}:${normalizeLowercaseStringOrEmpty(senderId)}`;
}

function defaultRole(globalId: string, env: NodeJS.ProcessEnv): SgRole {
  return env.SG_MONARCH_GLOBAL_USER_ID?.trim() === globalId ? "monarch" : "guest";
}

/** Atomically returns or creates the one SG profile bound to a canonical identity. */
export async function resolveSgGlobalProfile(params: {
  canonicalIdentity: string;
  env?: NodeJS.ProcessEnv;
  storePath?: string;
  now?: () => Date;
}): Promise<SgGlobalProfile> {
  const canonicalIdentity = params.canonicalIdentity.trim();
  if (!canonicalIdentity) {
    throw new Error("sg-canonical-identity-required");
  }
  const env = params.env ?? process.env;
  const storePath = params.storePath ?? profileStorePath(env);
  await mkdir(path.dirname(storePath), { recursive: true });
  return await withFileLock(storePath, STORE_LOCK_OPTIONS, async () => {
    const store = await readStore(storePath);
    const existing = store.profiles.find(
      (profile) => profile.canonicalIdentity === canonicalIdentity,
    );
    if (existing) {
      return existing;
    }
    const timestamp = (params.now?.() ?? new Date()).toISOString();
    const globalId = `usr_${randomUUID().replaceAll("-", "")}`;
    const profile: SgGlobalProfile = {
      globalId,
      canonicalIdentity,
      role: defaultRole(globalId, env),
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    store.profiles.push(profile);
    await writeStore(storePath, store);
    return profile;
  });
}

/** Builds domain metadata; it never grants or bypasses OpenClaw authorization. */
export function buildSgIdentityContext(profile: SgGlobalProfile): SgIdentityContext {
  return {
    globalId: profile.globalId,
    role: profile.role,
    profile,
    accessGroup: `sg-${profile.role}`,
  };
}

export async function updateSgGlobalProfile(params: {
  globalId: string;
  role?: SgRole;
  status?: SgProfileStatus;
  authorize: (current: SgGlobalProfile) => boolean | Promise<boolean>;
  env?: NodeJS.ProcessEnv;
  storePath?: string;
  now?: () => Date;
}): Promise<SgGlobalProfile> {
  const storePath = params.storePath ?? profileStorePath(params.env ?? process.env);
  await mkdir(path.dirname(storePath), { recursive: true });
  return await withFileLock(storePath, STORE_LOCK_OPTIONS, async () => {
    const store = await readStore(storePath);
    const index = store.profiles.findIndex((profile) => profile.globalId === params.globalId);
    if (index < 0) {
      throw new Error("sg-global-profile-not-found");
    }
    const current = store.profiles[index];
    if (!(await params.authorize(current))) {
      throw new Error("sg-global-profile-update-denied");
    }
    const updated: SgGlobalProfile = {
      ...current,
      ...(params.role ? { role: params.role } : {}),
      ...(params.status ? { status: params.status } : {}),
      updatedAt: (params.now?.() ?? new Date()).toISOString(),
    };
    store.profiles[index] = updated;
    await writeStore(storePath, store);
    return updated;
  });
}

export async function resolveSgIdentityContext(params: {
  channel: string;
  senderId: string;
  identityLinks?: Record<string, string[]>;
  env?: NodeJS.ProcessEnv;
  storePath?: string;
}): Promise<SgIdentityContext | undefined> {
  const canonicalIdentity = resolveSgCanonicalIdentity(params);
  if (!canonicalIdentity) {
    return undefined;
  }
  const profile = await resolveSgGlobalProfile({
    canonicalIdentity,
    env: params.env,
    storePath: params.storePath,
  });
  return buildSgIdentityContext(profile);
}
