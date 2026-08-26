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
  /** Primary identity retained for compatibility. Transport links are stored separately. */
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

type SgIdentityLink = {
  canonicalIdentity: string;
  globalId: string;
  createdAt: string;
  updatedAt: string;
};

type SgProfileStore = {
  version: 2;
  profiles: SgGlobalProfile[];
  identities: SgIdentityLink[];
};

const STORE_LOCK_OPTIONS = {
  retries: { retries: 100, factor: 1.1, minTimeout: 10, maxTimeout: 100 },
  stale: 30_000,
  staleRecovery: "fail-closed" as const,
};

const LEGACY_TIMESTAMP = "1970-01-01T00:00:00.000Z";

function profileStorePath(env: NodeJS.ProcessEnv): string {
  return path.join(resolveStateDir(env), "sg", "global-profiles.json");
}

function isRole(value: unknown): value is SgRole {
  return typeof value === "string" && (SG_ROLES as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is SgProfileStatus {
  return typeof value === "string" && ["active", "suspended", "archived"].includes(value);
}

function normalizeProfile(value: unknown, canonicalIdentityHint?: string): SgGlobalProfile | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as Record<string, unknown>;
  const globalId = typeof item.globalId === "string" ? item.globalId.trim() : "";
  const canonicalIdentity =
    typeof item.canonicalIdentity === "string"
      ? item.canonicalIdentity.trim()
      : (canonicalIdentityHint?.trim() ?? "");
  if (!globalId || !canonicalIdentity) {
    return null;
  }
  if (item.role !== undefined && !isRole(item.role)) {
    return null;
  }
  if (item.status !== undefined && !isStatus(item.status)) {
    return null;
  }
  const createdAt =
    typeof item.createdAt === "string" && item.createdAt.trim()
      ? item.createdAt
      : typeof item.updatedAt === "string" && item.updatedAt.trim()
        ? item.updatedAt
        : LEGACY_TIMESTAMP;
  const updatedAt =
    typeof item.updatedAt === "string" && item.updatedAt.trim() ? item.updatedAt : createdAt;
  return {
    globalId,
    canonicalIdentity,
    role: isRole(item.role) ? item.role : "guest",
    status: isStatus(item.status) ? item.status : "active",
    createdAt,
    updatedAt,
  };
}

function normalizeIdentityLink(value: unknown): SgIdentityLink | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as Record<string, unknown>;
  const canonicalIdentity =
    typeof item.canonicalIdentity === "string" ? item.canonicalIdentity.trim() : "";
  const globalId = typeof item.globalId === "string" ? item.globalId.trim() : "";
  if (!canonicalIdentity || !globalId) {
    return null;
  }
  const createdAt =
    typeof item.createdAt === "string" && item.createdAt.trim()
      ? item.createdAt
      : typeof item.updatedAt === "string" && item.updatedAt.trim()
        ? item.updatedAt
        : LEGACY_TIMESTAMP;
  const updatedAt =
    typeof item.updatedAt === "string" && item.updatedAt.trim() ? item.updatedAt : createdAt;
  return { canonicalIdentity, globalId, createdAt, updatedAt };
}

function validateStore(store: SgProfileStore): boolean {
  const profileIds = new Set(store.profiles.map((profile) => profile.globalId));
  if (profileIds.size !== store.profiles.length) {
    return false;
  }
  const identityKeys = new Set(store.identities.map((identity) => identity.canonicalIdentity));
  if (identityKeys.size !== store.identities.length) {
    return false;
  }
  return store.identities.every((identity) => profileIds.has(identity.globalId));
}

function normalizeStore(value: unknown): SgProfileStore | null {
  if (value === undefined) {
    return { version: 2, profiles: [], identities: [] };
  }

  let rawProfiles: Array<{ value: unknown; canonicalIdentityHint?: string }> | null = null;
  let rawIdentities: unknown[] | null = null;

  if (Array.isArray(value)) {
    rawProfiles = value.map((profile) => ({ value: profile }));
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length === 0) {
      rawProfiles = [];
    } else if (Array.isArray(record.profiles) && (record.version === undefined || record.version === 1 || record.version === 2)) {
      rawProfiles = record.profiles.map((profile) => ({ value: profile }));
      if (record.version === 2) {
        if (!Array.isArray(record.identities)) {
          return null;
        }
        rawIdentities = record.identities;
      }
    } else if (
      record.profiles &&
      typeof record.profiles === "object" &&
      !Array.isArray(record.profiles) &&
      (record.version === undefined || record.version === 1)
    ) {
      rawProfiles = Object.entries(record.profiles as Record<string, unknown>).map(
        ([canonicalIdentityHint, profile]) => ({ value: profile, canonicalIdentityHint }),
      );
    } else if (record.version === undefined) {
      const entries = Object.entries(record);
      if (
        entries.every(([, profile]) =>
          Boolean(profile && typeof profile === "object" && "globalId" in profile),
        )
      ) {
        rawProfiles = entries.map(([canonicalIdentityHint, profile]) => ({
          value: profile,
          canonicalIdentityHint,
        }));
      }
    }
  }

  if (!rawProfiles) {
    return null;
  }

  const profiles = rawProfiles.map(({ value: profile, canonicalIdentityHint }) =>
    normalizeProfile(profile, canonicalIdentityHint),
  );
  if (profiles.some((profile) => profile === null)) {
    return null;
  }
  const normalizedProfiles = profiles as SgGlobalProfile[];

  const identities = rawIdentities
    ? rawIdentities.map((identity) => normalizeIdentityLink(identity))
    : normalizedProfiles.map((profile) => ({
        canonicalIdentity: profile.canonicalIdentity,
        globalId: profile.globalId,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      }));
  if (identities.some((identity) => identity === null)) {
    return null;
  }

  const store: SgProfileStore = {
    version: 2,
    profiles: normalizedProfiles,
    identities: identities as SgIdentityLink[],
  };
  return validateStore(store) ? store : null;
}

async function readStore(storePath: string): Promise<SgProfileStore> {
  const value = await readJsonIfExists<unknown>(storePath);
  const store = normalizeStore(value);
  if (!store) {
    throw new Error("sg-global-profile-store-invalid");
  }
  return store;
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

/**
 * Resolves transport identity -> persistent Global ID -> profile.
 * This mirrors SG 2.1 identity-first semantics while keeping OpenClaw authorization authoritative.
 */
export async function resolveSgGlobalProfile(params: {
  canonicalIdentity: string;
  env?: NodeJS.ProcessEnv;
  storePath?: string;
  now?: () => Date;
  fixedGlobalId?: string;
  fixedRole?: SgRole;
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
    const timestamp = (params.now?.() ?? new Date()).toISOString();
    const fixedGlobalId = params.fixedGlobalId?.trim();
    const fixedRole = params.fixedRole;
    const existingLink = store.identities.find(
      (identity) => identity.canonicalIdentity === canonicalIdentity,
    );

    if (existingLink) {
      let profile = store.profiles.find((item) => item.globalId === existingLink.globalId);
      if (!profile) {
        throw new Error("sg-global-profile-store-invalid");
      }

      if (fixedGlobalId && fixedGlobalId !== profile.globalId) {
        const fixedProfile = store.profiles.find((item) => item.globalId === fixedGlobalId);
        if (fixedProfile) {
          const oldGlobalId = profile.globalId;
          for (const identity of store.identities) {
            if (identity.globalId === oldGlobalId) {
              identity.globalId = fixedGlobalId;
              identity.updatedAt = timestamp;
            }
          }
          store.profiles = store.profiles.filter((item) => item.globalId !== oldGlobalId);
          profile = fixedProfile;
        } else {
          const oldGlobalId = profile.globalId;
          profile.globalId = fixedGlobalId;
          profile.updatedAt = timestamp;
          for (const identity of store.identities) {
            if (identity.globalId === oldGlobalId) {
              identity.globalId = fixedGlobalId;
              identity.updatedAt = timestamp;
            }
          }
        }
      }

      if (fixedRole && profile.role !== fixedRole) {
        profile.role = fixedRole;
        profile.updatedAt = timestamp;
      }

      if (fixedGlobalId || fixedRole) {
        await writeStore(storePath, store);
      }
      return profile;
    }

    if (fixedGlobalId) {
      const fixedProfile = store.profiles.find((item) => item.globalId === fixedGlobalId);
      if (fixedProfile) {
        if (fixedRole && fixedProfile.role !== fixedRole) {
          fixedProfile.role = fixedRole;
          fixedProfile.updatedAt = timestamp;
        }
        store.identities.push({
          canonicalIdentity,
          globalId: fixedGlobalId,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        await writeStore(storePath, store);
        return fixedProfile;
      }
    }

    const globalId = fixedGlobalId || `usr_${randomUUID().replaceAll("-", "")}`;
    const profile: SgGlobalProfile = {
      globalId,
      canonicalIdentity,
      role: fixedRole ?? "guest",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    store.profiles.push(profile);
    store.identities.push({
      canonicalIdentity,
      globalId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
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

  const env = params.env ?? process.env;
  const monarchGlobalId = env.SG_MONARCH_GLOBAL_USER_ID?.trim();
  const monarchTelegramId =
    env.SG_MONARCH_TELEGRAM_USER_ID?.trim() || env.MONARCH_USER_ID?.trim();
  const isConfiguredMonarchTelegramAccount =
    normalizeLowercaseStringOrEmpty(params.channel) === "telegram" &&
    Boolean(monarchTelegramId) &&
    params.senderId.trim() === monarchTelegramId;

  if (isConfiguredMonarchTelegramAccount && !monarchGlobalId) {
    throw new Error("SG_MONARCH_GLOBAL_USER_ID is required when monarch Telegram identity is configured");
  }

  const profile = await resolveSgGlobalProfile({
    canonicalIdentity,
    env,
    storePath: params.storePath,
    ...(isConfiguredMonarchTelegramAccount && monarchGlobalId
      ? { fixedGlobalId: monarchGlobalId, fixedRole: "monarch" as const }
      : {}),
  });

  return buildSgIdentityContext(profile);
}
