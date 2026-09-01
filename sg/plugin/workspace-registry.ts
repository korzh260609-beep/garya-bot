import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { withFileLock } from "openclaw/plugin-sdk/file-lock";
import { readJsonFileWithFallback, writeJsonFileAtomically } from "openclaw/plugin-sdk/json-store";

export type SgWorkspaceResourceKind = "group" | "channel" | "room" | "topic";
export type SgWorkspaceStatus = "pending" | "active" | "suspended" | "archived";

export type SgWorkspaceResource = {
  platform: string;
  accountId?: string;
  resourceId: string;
  topicId?: string;
};

export type SgWorkspace = SgWorkspaceResource & {
  workspaceId: string;
  resourceKind: SgWorkspaceResourceKind;
  parentResourceId?: string;
  title: string;
  ownerGlobalId: string;
  status: SgWorkspaceStatus;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceStore = {
  version: 1;
  workspaces: SgWorkspace[];
};

const emptyStore = (): WorkspaceStore => ({ version: 1, workspaces: [] });
const LOCK_OPTIONS = {
  retries: { retries: 20, factor: 1.2, minTimeout: 10, maxTimeout: 100 },
  stale: 30_000,
  staleRecovery: "fail-closed" as const,
};

const normalizeRequired = (value: string, field: string, lowercase = false): string => {
  const trimmed = value.trim();
  const normalized = lowercase ? trimmed.toLowerCase() : trimmed;
  if (!normalized) {
    throw new Error(`sg-workspace-${field}-required`);
  }
  return normalized;
};

const normalizeOptional = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized || undefined;
};

export function normalizeWorkspaceResource(resource: SgWorkspaceResource): SgWorkspaceResource {
  const accountId = normalizeOptional(resource.accountId);
  const topicId = normalizeOptional(resource.topicId);
  return {
    platform: normalizeRequired(resource.platform, "platform", true),
    ...(accountId ? { accountId } : {}),
    resourceId: normalizeRequired(resource.resourceId, "resource-id"),
    ...(topicId ? { topicId } : {}),
  };
}

export function workspaceResourceKey(resource: SgWorkspaceResource): string {
  const normalized = normalizeWorkspaceResource(resource);
  return createHash("sha256")
    .update(
      JSON.stringify([
        normalized.platform,
        normalized.accountId ?? "default",
        normalized.resourceId,
        normalized.topicId ?? null,
      ]),
    )
    .digest("hex");
}

function isWorkspace(value: unknown): value is SgWorkspace {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<SgWorkspace>;
  return (
    typeof item.workspaceId === "string" &&
    typeof item.platform === "string" &&
    typeof item.resourceId === "string" &&
    ["group", "channel", "room", "topic"].includes(item.resourceKind ?? "") &&
    typeof item.title === "string" &&
    typeof item.ownerGlobalId === "string" &&
    ["pending", "active", "suspended", "archived"].includes(item.status ?? "") &&
    Boolean(item.settings) &&
    typeof item.settings === "object" &&
    !Array.isArray(item.settings) &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

function isWorkspaceStore(value: unknown): value is WorkspaceStore {
  if (!value || typeof value !== "object") {
    return false;
  }
  const store = value as Partial<WorkspaceStore>;
  if (
    store.version !== 1 ||
    !Array.isArray(store.workspaces) ||
    !store.workspaces.every(isWorkspace)
  ) {
    return false;
  }
  const resourceKeys = store.workspaces.map(workspaceResourceKey);
  const workspaceIds = store.workspaces.map((workspace) => workspace.workspaceId);
  return (
    new Set(resourceKeys).size === resourceKeys.length &&
    new Set(workspaceIds).size === workspaceIds.length
  );
}

export class SgWorkspaceRegistry {
  private readonly filePath: string;

  constructor(stateDir: string) {
    this.filePath = path.join(stateDir, "sg", "workspaces.json");
  }

  private async read(): Promise<WorkspaceStore> {
    const result = await readJsonFileWithFallback<unknown>(this.filePath, emptyStore());
    if (!result.exists) {
      return emptyStore();
    }
    if (!isWorkspaceStore(result.value)) {
      throw new Error("sg-workspace-store-invalid");
    }
    return result.value;
  }

  private async mutate<T>(fn: (store: WorkspaceStore) => T | Promise<T>): Promise<T> {
    return withFileLock(this.filePath, LOCK_OPTIONS, async () => {
      const store = await this.read();
      const result = await fn(store);
      await writeJsonFileAtomically(this.filePath, store);
      return result;
    });
  }

  async resolve(resource: SgWorkspaceResource): Promise<SgWorkspace | undefined> {
    const key = workspaceResourceKey(resource);
    return (await this.read()).workspaces.find(
      (workspace) => workspaceResourceKey(workspace) === key,
    );
  }

  async findById(workspaceId: string): Promise<SgWorkspace | undefined> {
    return (await this.read()).workspaces.find(
      (workspace) => workspace.workspaceId === workspaceId.trim(),
    );
  }

  async list(): Promise<SgWorkspace[]> {
    return structuredClone((await this.read()).workspaces);
  }

  async register(
    input: Omit<SgWorkspace, "workspaceId" | "createdAt" | "updatedAt">,
  ): Promise<SgWorkspace> {
    const normalized = normalizeWorkspaceResource(input);
    const key = workspaceResourceKey(normalized);
    return this.mutate((store) => {
      const existing = store.workspaces.find(
        (workspace) => workspaceResourceKey(workspace) === key,
      );
      if (existing) {
        return existing;
      }
      const now = new Date().toISOString();
      const workspace: SgWorkspace = {
        ...input,
        ...normalized,
        workspaceId: `wsp_${randomUUID()}`,
        title: input.title.trim(),
        ownerGlobalId: normalizeRequired(input.ownerGlobalId, "owner-global-id"),
        settings: { ...input.settings },
        createdAt: now,
        updatedAt: now,
      };
      if (!workspace.title) {
        throw new Error("sg-workspace-title-required");
      }
      store.workspaces.push(workspace);
      return workspace;
    });
  }

  async setStatus(
    workspaceId: string,
    status: SgWorkspaceStatus,
  ): Promise<SgWorkspace | undefined> {
    return this.mutate((store) => {
      const index = store.workspaces.findIndex(
        (workspace) => workspace.workspaceId === workspaceId,
      );
      if (index < 0) {
        return undefined;
      }
      const updated = { ...store.workspaces[index], status, updatedAt: new Date().toISOString() };
      store.workspaces[index] = updated;
      return updated;
    });
  }
}

export function formatWorkspaceResolution(workspace: SgWorkspace | undefined): string {
  if (!workspace) {
    return "SG Workspace Manager — ресурс не зарегистрирован";
  }
  return [
    "SG Workspace Manager — WSP2",
    `Workspace ID: ${workspace.workspaceId}`,
    `Тип: ${workspace.resourceKind}`,
    `Статус: ${workspace.status}`,
    `Название: ${workspace.title}`,
  ].join("\n");
}
