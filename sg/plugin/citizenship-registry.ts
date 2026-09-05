import { randomUUID } from "node:crypto";
import path from "node:path";
import { withFileLock } from "openclaw/plugin-sdk/file-lock";
import { readJsonFileWithFallback, writeJsonFileAtomically } from "openclaw/plugin-sdk/json-store";

export type SgProjectRole = "citizen" | "monarch";
export type SgPersistedProjectRole = SgProjectRole | "guest";
export type SgProfileStatus = "active" | "suspended" | "archived";

export type SgGlobalProfile = {
  globalId: string;
  canonicalIdentity: string;
  role: SgPersistedProjectRole;
  status: SgProfileStatus;
  createdAt: string;
  updatedAt: string;
};

export type SgIdentityLink = {
  canonicalIdentity: string;
  globalId: string;
  createdAt: string;
  updatedAt: string;
};

export type SgGlobalProfileStore = {
  version: 5;
  monarchGlobalId?: string;
  profiles: SgGlobalProfile[];
  identities: SgIdentityLink[];
};

const emptyStore = (): SgGlobalProfileStore => ({
  version: 5,
  profiles: [],
  identities: [],
});

const LOCK_OPTIONS = {
  retries: { retries: 20, factor: 1.2, minTimeout: 10, maxTimeout: 100 },
  stale: 30_000,
  staleRecovery: "fail-closed" as const,
};

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && Boolean(value.trim());
const validTimestamp = (value: unknown): value is string =>
  nonEmpty(value) && !Number.isNaN(Date.parse(value));

function validProfile(value: unknown): value is SgGlobalProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<SgGlobalProfile>;
  return (
    nonEmpty(profile.globalId) &&
    nonEmpty(profile.canonicalIdentity) &&
    ["guest", "citizen", "monarch"].includes(profile.role ?? "") &&
    ["active", "suspended", "archived"].includes(profile.status ?? "") &&
    validTimestamp(profile.createdAt) &&
    validTimestamp(profile.updatedAt)
  );
}

function validIdentity(value: unknown): value is SgIdentityLink {
  if (!value || typeof value !== "object") return false;
  const identity = value as Partial<SgIdentityLink>;
  return (
    nonEmpty(identity.canonicalIdentity) &&
    nonEmpty(identity.globalId) &&
    validTimestamp(identity.createdAt) &&
    validTimestamp(identity.updatedAt)
  );
}

function normalizeStore(value: unknown): SgGlobalProfileStore | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as {
    version?: unknown;
    monarchGlobalId?: unknown;
    profiles?: unknown;
    identities?: unknown;
    citizenRequests?: unknown;
    audit?: unknown;
  };
  if (!Array.isArray(candidate.profiles) || !Array.isArray(candidate.identities)) return undefined;
  if (!candidate.profiles.every(validProfile) || !candidate.identities.every(validIdentity)) {
    return undefined;
  }
  const legacyFieldsEmpty =
    Array.isArray(candidate.citizenRequests) &&
    candidate.citizenRequests.length === 0 &&
    Array.isArray(candidate.audit) &&
    candidate.audit.length === 0;
  const activeMonarchs = candidate.profiles.filter(
    (profile) => profile.role === "monarch" && profile.status === "active",
  );
  const declaredMonarchGlobalId =
    (candidate.version === 4 || candidate.version === 5) && nonEmpty(candidate.monarchGlobalId)
      ? candidate.monarchGlobalId.trim()
      : activeMonarchs[0]?.globalId;
  const store: SgGlobalProfileStore | undefined =
    candidate.version === 2
      ? {
          version: 5,
          ...(declaredMonarchGlobalId ? { monarchGlobalId: declaredMonarchGlobalId } : {}),
          profiles: candidate.profiles,
          identities: candidate.identities,
        }
      : (candidate.version === 3 || candidate.version === 4) && legacyFieldsEmpty
        ? {
            version: 5,
            ...(declaredMonarchGlobalId ? { monarchGlobalId: declaredMonarchGlobalId } : {}),
            profiles: candidate.profiles,
            identities: candidate.identities,
          }
        : candidate.version === 5 &&
            candidate.citizenRequests === undefined &&
            candidate.audit === undefined
          ? {
              version: 5,
              ...(declaredMonarchGlobalId ? { monarchGlobalId: declaredMonarchGlobalId } : {}),
              profiles: candidate.profiles,
              identities: candidate.identities,
            }
          : undefined;
  if (!store) return undefined;

  const profileIds = store.profiles.map((profile) => profile.globalId);
  const canonicalProfiles = store.profiles.map((profile) => profile.canonicalIdentity);
  const canonicalLinks = store.identities.map((identity) => identity.canonicalIdentity);
  const profileIdSet = new Set(profileIds);
  if (
    new Set(profileIds).size !== profileIds.length ||
    new Set(canonicalProfiles).size !== canonicalProfiles.length ||
    new Set(canonicalLinks).size !== canonicalLinks.length ||
    activeMonarchs.length > 1 ||
    (store.monarchGlobalId !== undefined &&
      !activeMonarchs.some((profile) => profile.globalId === store.monarchGlobalId)) ||
    store.identities.some((identity) => !profileIdSet.has(identity.globalId))
  ) {
    return undefined;
  }
  return store;
}

export class SgGlobalProfileRegistry {
  private readonly filePath: string;
  private readonly monarchGlobalId?: string;
  private readonly monarchCanonicalIdentity?: string;

  constructor(
    stateDir: string,
    options: { monarchGlobalId?: string; monarchCanonicalIdentity?: string } = {},
  ) {
    this.filePath = path.join(stateDir, "sg", "global-profiles.json");
    this.monarchGlobalId =
      options.monarchGlobalId?.trim() || process.env.SG_MONARCH_GLOBAL_USER_ID?.trim() || undefined;
    const configuredCanonicalIdentity = (
      options.monarchCanonicalIdentity?.trim() ||
      process.env.SG_MONARCH_TELEGRAM_USER_ID?.trim() ||
      process.env.MONARCH_USER_ID?.trim()
    )?.toLowerCase();
    this.monarchCanonicalIdentity = configuredCanonicalIdentity
      ? configuredCanonicalIdentity.startsWith("channel:")
        ? configuredCanonicalIdentity.toLowerCase()
        : `channel:telegram:${configuredCanonicalIdentity.replace(/^telegram:/iu, "").toLowerCase()}`
      : undefined;
  }

  private async read(): Promise<SgGlobalProfileStore> {
    const result = await readJsonFileWithFallback<unknown>(this.filePath, emptyStore());
    if (!result.exists) return emptyStore();
    const store = normalizeStore(result.value);
    if (!store) throw new Error("sg-global-profile-store-invalid");
    return store;
  }

  private async mutate<T>(fn: (store: SgGlobalProfileStore) => T | Promise<T>): Promise<T> {
    return withFileLock(this.filePath, LOCK_OPTIONS, async () => {
      const store = await this.read();
      const result = await fn(store);
      if (
        this.monarchGlobalId &&
        store.profiles.some(
          (profile) =>
            profile.globalId === this.monarchGlobalId &&
            profile.role === "monarch" &&
            profile.status === "active",
        )
      ) {
        store.monarchGlobalId = this.monarchGlobalId;
      }
      await writeJsonFileAtomically(this.filePath, store);
      return result;
    });
  }

  async snapshot(): Promise<SgGlobalProfileStore> {
    return structuredClone(await this.read());
  }

  async findByCanonicalIdentity(canonicalIdentity: string): Promise<SgGlobalProfile | undefined> {
    const store = await this.read();
    const link = store.identities.find(
      (identity) => identity.canonicalIdentity === canonicalIdentity.trim(),
    );
    const profile = link
      ? store.profiles.find((candidate) => candidate.globalId === link.globalId)
      : undefined;
    return profile?.status === "active" ? profile : undefined;
  }

  async findByGlobalId(globalId: string): Promise<SgGlobalProfile | undefined> {
    const profile = (await this.read()).profiles.find(
      (candidate) => candidate.globalId === globalId.trim(),
    );
    return profile?.status === "active" ? profile : undefined;
  }

  async ensureProfile(canonicalIdentity: string): Promise<SgGlobalProfile> {
    const canonical = canonicalIdentity.trim().toLowerCase();
    if (!canonical) throw new Error("sg-profile-canonical-identity-required");
    const currentStore = await this.read();
    const currentLink = currentStore.identities.find(
      (identity) => identity.canonicalIdentity === canonical,
    );
    const currentProfile = currentLink
      ? currentStore.profiles.find((profile) => profile.globalId === currentLink.globalId)
      : undefined;
    const configuredMonarch = canonical === this.monarchCanonicalIdentity;
    if (
      currentProfile?.status === "active" &&
      currentProfile.role !== "guest" &&
      (!configuredMonarch ||
        (Boolean(this.monarchGlobalId) &&
          currentProfile.globalId === this.monarchGlobalId &&
          currentProfile.role === "monarch" &&
          currentStore.monarchGlobalId === this.monarchGlobalId))
    ) {
      if (
        currentProfile.role === "monarch" &&
        this.monarchGlobalId &&
        currentProfile.globalId !== this.monarchGlobalId
      ) {
        throw new Error("sg-monarch-uniqueness-conflict");
      }
      return structuredClone(currentProfile);
    }
    return this.mutate((store) => {
      const link = store.identities.find((identity) => identity.canonicalIdentity === canonical);
      const existing = link
        ? store.profiles.find((profile) => profile.globalId === link.globalId)
        : undefined;
      const now = new Date().toISOString();

      if (existing) {
        if (configuredMonarch) {
          if (!this.monarchGlobalId || existing.globalId !== this.monarchGlobalId) {
            throw new Error("sg-monarch-identity-conflict");
          }
          const otherMonarch = store.profiles.find(
            (profile) => profile.role === "monarch" && profile.globalId !== existing.globalId,
          );
          if (otherMonarch) throw new Error("sg-monarch-uniqueness-conflict");
          existing.role = "monarch";
          existing.status = "active";
          existing.updatedAt = now;
          store.monarchGlobalId = existing.globalId;
          return structuredClone(existing);
        }
        if (existing.role === "monarch") {
          return structuredClone(existing);
        }
        if (existing.role === "guest") {
          existing.role = "citizen";
          existing.status = "active";
          existing.updatedAt = now;
        } else if (existing.status !== "active") {
          throw new Error("sg-profile-not-active");
        }
        return structuredClone(existing);
      }

      const globalId = configuredMonarch ? this.monarchGlobalId : `usr_${randomUUID()}`;
      if (!globalId) throw new Error("sg-monarch-global-id-required");
      if (store.profiles.some((profile) => profile.globalId === globalId)) {
        throw new Error("sg-profile-global-id-conflict");
      }
      if (configuredMonarch && store.profiles.some((profile) => profile.role === "monarch")) {
        throw new Error("sg-monarch-uniqueness-conflict");
      }
      const profile: SgGlobalProfile = {
        globalId,
        canonicalIdentity: canonical,
        role: configuredMonarch ? "monarch" : "citizen",
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      store.profiles.push(profile);
      store.identities.push({
        canonicalIdentity: canonical,
        globalId,
        createdAt: now,
        updatedAt: now,
      });
      if (configuredMonarch) store.monarchGlobalId = globalId;
      return structuredClone(profile);
    });
  }

  async validateMonarchConfiguration(): Promise<SgGlobalProfile> {
    if (!this.monarchGlobalId || !this.monarchCanonicalIdentity) {
      throw new Error("sg-monarch-configuration-required");
    }
    const monarch = await this.ensureProfile(this.monarchCanonicalIdentity);
    const store = await this.read();
    const activeMonarchs = store.profiles.filter(
      (profile) => profile.role === "monarch" && profile.status === "active",
    );
    if (
      activeMonarchs.length !== 1 ||
      monarch.globalId !== this.monarchGlobalId ||
      store.monarchGlobalId !== this.monarchGlobalId
    ) {
      throw new Error("sg-monarch-configuration-invalid");
    }
    return monarch;
  }
}

export function validateGlobalProfileStore(value: unknown): value is SgGlobalProfileStore {
  return Boolean(normalizeStore(value));
}
