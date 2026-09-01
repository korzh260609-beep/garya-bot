import { randomUUID } from "node:crypto";
import path from "node:path";
import { withFileLock } from "openclaw/plugin-sdk/file-lock";
import { readJsonFileWithFallback, writeJsonFileAtomically } from "openclaw/plugin-sdk/json-store";
import { SgGlobalProfileRegistry } from "./citizenship-registry.js";
import { SgWorkspaceRegistry, type SgWorkspace } from "./workspace-registry.js";

export type SgWorkspaceMemberRole = "admin" | "member";
export type SgWorkspaceMembershipStatus = "active" | "revoked";
export type SgWorkspaceMembership = {
  membershipId: string;
  workspaceId: string;
  globalId: string;
  role: SgWorkspaceMemberRole;
  status: SgWorkspaceMembershipStatus;
  operationId: string;
  grantedByGlobalId: string;
  revokedByGlobalId?: string;
  createdAt: string;
  updatedAt: string;
};

export type SgMembershipAuditEvent = {
  eventId: string;
  operationId: string;
  action: "grant" | "revoke";
  workspaceId: string;
  targetGlobalId: string;
  actorGlobalId: string;
  role: SgWorkspaceMemberRole;
  createdAt: string;
};

export type SgWorkspaceMembershipStore = {
  version: 1;
  memberships: SgWorkspaceMembership[];
  audit: SgMembershipAuditEvent[];
};

export type SgEffectiveWorkspaceRole = "owner" | SgWorkspaceMemberRole;

const emptyStore = (): SgWorkspaceMembershipStore => ({ version: 1, memberships: [], audit: [] });
const LOCK_OPTIONS = {
  retries: { retries: 20, factor: 1.2, minTimeout: 10, maxTimeout: 100 },
  stale: 30_000,
  staleRecovery: "fail-closed" as const,
};
const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && Boolean(value.trim());
const timestamp = (value: unknown): value is string =>
  nonEmpty(value) && !Number.isNaN(Date.parse(value));

function validMembership(value: unknown): value is SgWorkspaceMembership {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SgWorkspaceMembership>;
  return (
    nonEmpty(item.membershipId) &&
    nonEmpty(item.workspaceId) &&
    nonEmpty(item.globalId) &&
    ["admin", "member"].includes(item.role ?? "") &&
    ["active", "revoked"].includes(item.status ?? "") &&
    nonEmpty(item.operationId) &&
    nonEmpty(item.grantedByGlobalId) &&
    (item.revokedByGlobalId === undefined || nonEmpty(item.revokedByGlobalId)) &&
    timestamp(item.createdAt) &&
    timestamp(item.updatedAt)
  );
}

function validAudit(value: unknown): value is SgMembershipAuditEvent {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SgMembershipAuditEvent>;
  return (
    nonEmpty(item.eventId) &&
    nonEmpty(item.operationId) &&
    ["grant", "revoke"].includes(item.action ?? "") &&
    nonEmpty(item.workspaceId) &&
    nonEmpty(item.targetGlobalId) &&
    nonEmpty(item.actorGlobalId) &&
    ["admin", "member"].includes(item.role ?? "") &&
    timestamp(item.createdAt)
  );
}

export function validateWorkspaceMembershipStore(
  value: unknown,
): value is SgWorkspaceMembershipStore {
  if (!value || typeof value !== "object") return false;
  const store = value as Partial<SgWorkspaceMembershipStore>;
  if (
    store.version !== 1 ||
    !Array.isArray(store.memberships) ||
    !store.memberships.every(validMembership) ||
    !Array.isArray(store.audit) ||
    !store.audit.every(validAudit)
  ) {
    return false;
  }
  const keys = store.memberships.map((item) => `${item.workspaceId}\0${item.globalId}`);
  const ids = store.memberships.map((item) => item.membershipId);
  const eventIds = store.audit.map((item) => item.eventId);
  const operationIds = store.audit.map((item) => item.operationId);
  const auditOperations = new Set(operationIds);
  return (
    new Set(keys).size === keys.length &&
    new Set(ids).size === ids.length &&
    new Set(eventIds).size === eventIds.length &&
    new Set(operationIds).size === operationIds.length &&
    store.memberships.every((item) => auditOperations.has(item.operationId))
  );
}

export class SgWorkspaceMembershipRegistry {
  private readonly filePath: string;
  private readonly profiles: SgGlobalProfileRegistry;
  private readonly workspaces: SgWorkspaceRegistry;

  constructor(private readonly stateDir: string) {
    this.filePath = path.join(stateDir, "sg", "workspace-memberships.json");
    this.profiles = new SgGlobalProfileRegistry(stateDir);
    this.workspaces = new SgWorkspaceRegistry(stateDir);
  }

  private async read(): Promise<SgWorkspaceMembershipStore> {
    const result = await readJsonFileWithFallback<unknown>(this.filePath, emptyStore());
    if (!result.exists) return emptyStore();
    if (!validateWorkspaceMembershipStore(result.value)) {
      throw new Error("sg-workspace-membership-store-invalid");
    }
    return result.value;
  }

  private async mutate<T>(fn: (store: SgWorkspaceMembershipStore) => T | Promise<T>): Promise<T> {
    return withFileLock(this.filePath, LOCK_OPTIONS, async () => {
      const store = await this.read();
      const result = await fn(store);
      await writeJsonFileAtomically(this.filePath, store);
      return result;
    });
  }

  private async authorizeManager(
    actorGlobalId: string,
    workspaceId: string,
  ): Promise<SgWorkspace> {
    const [actor, workspace] = await Promise.all([
      this.profiles.findByGlobalId(actorGlobalId),
      this.workspaces.findById(workspaceId),
    ]);
    if (!workspace) throw new Error("sg-workspace-not-found");
    if (workspace.status !== "active") throw new Error("sg-workspace-not-active");
    if (!actor) throw new Error("sg-workspace-membership-actor-inactive");
    if (actor.role !== "monarch" && workspace.ownerGlobalId !== actor.globalId) {
      throw new Error("sg-workspace-membership-manager-required");
    }
    return workspace;
  }

  async snapshot(): Promise<SgWorkspaceMembershipStore> {
    return structuredClone(await this.read());
  }

  async resolve(
    workspaceId: string,
    globalId: string,
  ): Promise<SgWorkspaceMembership | undefined> {
    return (await this.read()).memberships.find(
      (item) => item.workspaceId === workspaceId.trim() && item.globalId === globalId.trim(),
    );
  }

  async effectiveRole(
    workspaceId: string,
    globalId: string,
  ): Promise<SgEffectiveWorkspaceRole | undefined> {
    const [workspace, profile, membership] = await Promise.all([
      this.workspaces.findById(workspaceId),
      this.profiles.findByGlobalId(globalId),
      this.resolve(workspaceId, globalId),
    ]);
    if (!workspace || workspace.status !== "active" || !profile) return undefined;
    if (workspace.ownerGlobalId === profile.globalId) return "owner";
    return membership?.status === "active" ? membership.role : undefined;
  }

  async list(actorGlobalId: string, workspaceId: string): Promise<SgWorkspaceMembership[]> {
    await this.authorizeManager(actorGlobalId, workspaceId);
    return (await this.read()).memberships.filter(
      (item) => item.workspaceId === workspaceId.trim() && item.status === "active",
    );
  }

  async audit(actorGlobalId: string, workspaceId: string): Promise<SgMembershipAuditEvent[]> {
    await this.authorizeManager(actorGlobalId, workspaceId);
    return (await this.read()).audit.filter((item) => item.workspaceId === workspaceId.trim());
  }

  async grant(input: {
    actorGlobalId: string;
    workspaceId: string;
    targetGlobalId: string;
    role: SgWorkspaceMemberRole;
  }): Promise<{ status: "granted" | "already_active"; membership: SgWorkspaceMembership }> {
    const workspace = await this.authorizeManager(input.actorGlobalId, input.workspaceId);
    const target = await this.profiles.findByGlobalId(input.targetGlobalId);
    if (!target || !["citizen", "monarch"].includes(target.role)) {
      throw new Error("sg-workspace-membership-target-citizen-required");
    }
    if (workspace.ownerGlobalId === target.globalId) {
      throw new Error("sg-workspace-membership-owner-is-implicit");
    }
    if (!(["admin", "member"] as string[]).includes(input.role)) {
      throw new Error("sg-workspace-membership-role-invalid");
    }
    return this.mutate((store) => {
      const index = store.memberships.findIndex(
        (item) => item.workspaceId === workspace.workspaceId && item.globalId === target.globalId,
      );
      const current = index >= 0 ? store.memberships[index] : undefined;
      if (current?.status === "active" && current.role === input.role) {
        return { status: "already_active", membership: current };
      }
      const now = new Date().toISOString();
      const operationId = `op_${randomUUID()}`;
      const membership: SgWorkspaceMembership = {
        membershipId: current?.membershipId ?? `mem_${randomUUID()}`,
        workspaceId: workspace.workspaceId,
        globalId: target.globalId,
        role: input.role,
        status: "active",
        operationId,
        grantedByGlobalId: input.actorGlobalId.trim(),
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };
      if (index >= 0) store.memberships[index] = membership;
      else store.memberships.push(membership);
      store.audit.push({
        eventId: `memevt_${randomUUID()}`,
        operationId,
        action: "grant",
        workspaceId: workspace.workspaceId,
        targetGlobalId: target.globalId,
        actorGlobalId: input.actorGlobalId.trim(),
        role: input.role,
        createdAt: now,
      });
      return { status: "granted", membership };
    });
  }

  async revoke(input: {
    actorGlobalId: string;
    workspaceId: string;
    targetGlobalId: string;
  }): Promise<{ status: "revoked" | "already_revoked" | "not_member"; membership?: SgWorkspaceMembership }> {
    const workspace = await this.authorizeManager(input.actorGlobalId, input.workspaceId);
    if (workspace.ownerGlobalId === input.targetGlobalId.trim()) {
      throw new Error("sg-workspace-membership-owner-cannot-revoke");
    }
    return this.mutate((store) => {
      const index = store.memberships.findIndex(
        (item) =>
          item.workspaceId === workspace.workspaceId &&
          item.globalId === input.targetGlobalId.trim(),
      );
      if (index < 0) return { status: "not_member" };
      const current = store.memberships[index];
      if (current.status === "revoked") {
        return { status: "already_revoked", membership: current };
      }
      const now = new Date().toISOString();
      const operationId = `op_${randomUUID()}`;
      const membership: SgWorkspaceMembership = {
        ...current,
        status: "revoked",
        operationId,
        revokedByGlobalId: input.actorGlobalId.trim(),
        updatedAt: now,
      };
      store.memberships[index] = membership;
      store.audit.push({
        eventId: `memevt_${randomUUID()}`,
        operationId,
        action: "revoke",
        workspaceId: workspace.workspaceId,
        targetGlobalId: current.globalId,
        actorGlobalId: input.actorGlobalId.trim(),
        role: current.role,
        createdAt: now,
      });
      return { status: "revoked", membership };
    });
  }
}
