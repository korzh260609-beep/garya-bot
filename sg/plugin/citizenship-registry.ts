import { randomUUID } from "node:crypto";
import path from "node:path";
import { withFileLock } from "openclaw/plugin-sdk/file-lock";
import { readJsonFileWithFallback, writeJsonFileAtomically } from "openclaw/plugin-sdk/json-store";

export type SgProjectRole = "guest" | "citizen" | "monarch";
export type SgProfileStatus = "active" | "suspended" | "archived";

export type SgGlobalProfile = {
  globalId: string;
  canonicalIdentity: string;
  role: SgProjectRole;
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

export type SgCitizenRequestStatus = "pending" | "approved" | "rejected";
export type SgCitizenRequest = {
  requestId: string;
  canonicalIdentity: string;
  status: SgCitizenRequestStatus;
  operationId: string;
  resultingGlobalId?: string;
  decidedByGlobalId?: string;
  createdAt: string;
  updatedAt: string;
};

export type SgCitizenAuditAction = "apply" | "approve" | "reject";
export type SgCitizenAuditEvent = {
  eventId: string;
  operationId: string;
  action: SgCitizenAuditAction;
  requestId: string;
  canonicalIdentity: string;
  actorGlobalId?: string;
  resultingGlobalId?: string;
  createdAt: string;
};

export type SgGlobalProfileStore = {
  version: 3;
  profiles: SgGlobalProfile[];
  identities: SgIdentityLink[];
  citizenRequests: SgCitizenRequest[];
  audit: SgCitizenAuditEvent[];
};

const emptyStore = (): SgGlobalProfileStore => ({
  version: 3,
  profiles: [],
  identities: [],
  citizenRequests: [],
  audit: [],
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

function validRequest(value: unknown): value is SgCitizenRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Partial<SgCitizenRequest>;
  return (
    nonEmpty(request.requestId) &&
    nonEmpty(request.canonicalIdentity) &&
    ["pending", "approved", "rejected"].includes(request.status ?? "") &&
    nonEmpty(request.operationId) &&
    (request.resultingGlobalId === undefined || nonEmpty(request.resultingGlobalId)) &&
    (request.decidedByGlobalId === undefined || nonEmpty(request.decidedByGlobalId)) &&
    validTimestamp(request.createdAt) &&
    validTimestamp(request.updatedAt)
  );
}

function validAudit(value: unknown): value is SgCitizenAuditEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<SgCitizenAuditEvent>;
  return (
    nonEmpty(event.eventId) &&
    nonEmpty(event.operationId) &&
    ["apply", "approve", "reject"].includes(event.action ?? "") &&
    nonEmpty(event.requestId) &&
    nonEmpty(event.canonicalIdentity) &&
    (event.actorGlobalId === undefined || nonEmpty(event.actorGlobalId)) &&
    (event.resultingGlobalId === undefined || nonEmpty(event.resultingGlobalId)) &&
    validTimestamp(event.createdAt)
  );
}

function normalizeStore(value: unknown): SgGlobalProfileStore | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as {
    version?: unknown;
    profiles?: unknown;
    identities?: unknown;
    citizenRequests?: unknown;
    audit?: unknown;
  };
  if (!Array.isArray(candidate.profiles) || !Array.isArray(candidate.identities)) return undefined;
  if (!candidate.profiles.every(validProfile) || !candidate.identities.every(validIdentity)) {
    return undefined;
  }
  const store: SgGlobalProfileStore =
    candidate.version === 2
      ? {
          version: 3,
          profiles: candidate.profiles,
          identities: candidate.identities,
          citizenRequests: [],
          audit: [],
        }
      : candidate.version === 3 &&
          Array.isArray(candidate.citizenRequests) &&
          candidate.citizenRequests.every(validRequest) &&
          Array.isArray(candidate.audit) &&
          candidate.audit.every(validAudit)
        ? {
            version: 3,
            profiles: candidate.profiles,
            identities: candidate.identities,
            citizenRequests: candidate.citizenRequests,
            audit: candidate.audit,
          }
        : undefined;
  if (!store) return undefined;

  const profileIds = store.profiles.map((profile) => profile.globalId);
  const canonicalProfiles = store.profiles.map((profile) => profile.canonicalIdentity);
  const canonicalLinks = store.identities.map((identity) => identity.canonicalIdentity);
  const requestIds = store.citizenRequests.map((request) => request.requestId);
  const pendingIdentities = store.citizenRequests
    .filter((request) => request.status === "pending")
    .map((request) => request.canonicalIdentity);
  const eventIds = store.audit.map((event) => event.eventId);
  const operationIds = store.audit.map((event) => event.operationId);
  const profileIdSet = new Set(profileIds);
  const requestIdSet = new Set(requestIds);
  if (
    new Set(profileIds).size !== profileIds.length ||
    new Set(canonicalProfiles).size !== canonicalProfiles.length ||
    new Set(canonicalLinks).size !== canonicalLinks.length ||
    new Set(requestIds).size !== requestIds.length ||
    new Set(pendingIdentities).size !== pendingIdentities.length ||
    new Set(eventIds).size !== eventIds.length ||
    new Set(operationIds).size !== operationIds.length ||
    store.identities.some((identity) => !profileIdSet.has(identity.globalId)) ||
    store.citizenRequests.some(
      (request) => request.status === "approved" && !request.resultingGlobalId,
    ) ||
    store.audit.some((event) => !requestIdSet.has(event.requestId))
  ) {
    return undefined;
  }
  return store;
}

function requireMonarch(store: SgGlobalProfileStore, actorGlobalId: string): SgGlobalProfile {
  const actor = store.profiles.find((profile) => profile.globalId === actorGlobalId.trim());
  if (!actor || actor.status !== "active" || actor.role !== "monarch") {
    throw new Error("sg-citizen-monarch-required");
  }
  return actor;
}

export class SgGlobalProfileRegistry {
  private readonly filePath: string;

  constructor(stateDir: string) {
    this.filePath = path.join(stateDir, "sg", "global-profiles.json");
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

  async apply(canonicalIdentity: string): Promise<{
    status: "pending" | "already_registered";
    request?: SgCitizenRequest;
    profile?: SgGlobalProfile;
  }> {
    const canonical = canonicalIdentity.trim();
    if (!canonical) throw new Error("sg-citizen-canonical-identity-required");
    return this.mutate((store) => {
      const link = store.identities.find((identity) => identity.canonicalIdentity === canonical);
      const profile = link
        ? store.profiles.find((candidate) => candidate.globalId === link.globalId)
        : undefined;
      const eligibleGuest = profile?.status === "active" && profile.role === "guest";
      if (profile && !eligibleGuest) {
        return { status: "already_registered", profile };
      }
      const existing = store.citizenRequests.find(
        (request) => request.canonicalIdentity === canonical && request.status === "pending",
      );
      if (existing) return { status: "pending", request: existing };
      const now = new Date().toISOString();
      const operationId = `op_${randomUUID()}`;
      const request: SgCitizenRequest = {
        requestId: `citreq_${randomUUID()}`,
        canonicalIdentity: canonical,
        status: "pending",
        operationId,
        createdAt: now,
        updatedAt: now,
      };
      store.citizenRequests.push(request);
      store.audit.push({
        eventId: `citevt_${randomUUID()}`,
        operationId,
        action: "apply",
        requestId: request.requestId,
        canonicalIdentity: canonical,
        createdAt: now,
      });
      return { status: "pending", request };
    });
  }

  async listPending(actorGlobalId: string): Promise<SgCitizenRequest[]> {
    const store = await this.read();
    requireMonarch(store, actorGlobalId);
    return store.citizenRequests.filter((request) => request.status === "pending");
  }

  async decide(input: {
    actorGlobalId: string;
    requestId: string;
    decision: "approve" | "reject";
  }): Promise<{ request: SgCitizenRequest; profile?: SgGlobalProfile }> {
    return this.mutate((store) => {
      requireMonarch(store, input.actorGlobalId);
      const index = store.citizenRequests.findIndex(
        (request) => request.requestId === input.requestId.trim(),
      );
      if (index < 0) throw new Error("sg-citizen-request-not-found");
      const current = store.citizenRequests[index];
      if (current.status !== "pending") throw new Error("sg-citizen-request-already-decided");
      const now = new Date().toISOString();
      const operationId = `op_${randomUUID()}`;
      let profile: SgGlobalProfile | undefined;
      if (input.decision === "approve") {
        const identity = store.identities.find(
          (candidate) => candidate.canonicalIdentity === current.canonicalIdentity,
        );
        const existingProfile = identity
          ? store.profiles.find((candidate) => candidate.globalId === identity.globalId)
          : undefined;
        if (
          identity &&
          (existingProfile?.status !== "active" || existingProfile.role !== "guest")
        ) {
          throw new Error("sg-citizen-identity-already-linked");
        }
        if (existingProfile) {
          existingProfile.role = "citizen";
          existingProfile.updatedAt = now;
          profile = existingProfile;
        } else {
          const globalId = `usr_${randomUUID()}`;
          profile = {
            globalId,
            canonicalIdentity: current.canonicalIdentity,
            role: "citizen",
            status: "active",
            createdAt: now,
            updatedAt: now,
          };
          store.profiles.push(profile);
          store.identities.push({
            canonicalIdentity: current.canonicalIdentity,
            globalId,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      const request: SgCitizenRequest = {
        ...current,
        status: input.decision === "approve" ? "approved" : "rejected",
        operationId,
        ...(profile ? { resultingGlobalId: profile.globalId } : {}),
        decidedByGlobalId: input.actorGlobalId.trim(),
        updatedAt: now,
      };
      store.citizenRequests[index] = request;
      store.audit.push({
        eventId: `citevt_${randomUUID()}`,
        operationId,
        action: input.decision,
        requestId: request.requestId,
        canonicalIdentity: request.canonicalIdentity,
        actorGlobalId: input.actorGlobalId.trim(),
        ...(profile ? { resultingGlobalId: profile.globalId } : {}),
        createdAt: now,
      });
      return { request, ...(profile ? { profile } : {}) };
    });
  }
}

export function validateGlobalProfileStore(value: unknown): value is SgGlobalProfileStore {
  return Boolean(normalizeStore(value));
}
