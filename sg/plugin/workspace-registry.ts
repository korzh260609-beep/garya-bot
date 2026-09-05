import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { withFileLock } from "openclaw/plugin-sdk/file-lock";
import { readJsonFileWithFallback, writeJsonFileAtomically } from "openclaw/plugin-sdk/json-store";

export type SgWorkspaceResourceKind = "group" | "channel" | "room" | "topic";

export type SgWorkspaceResource = {
  platform: string;
  accountId?: string;
  resourceId: string;
  topicId?: string;
};

export type SgResourceScope = SgWorkspaceResource & {
  resourceScopeId: string;
  resourceKind: SgWorkspaceResourceKind;
  parentResourceId?: string;
  createdAt: string;
  updatedAt: string;
};

// Transitional WSP5/WSP6 view. It contains no persisted SG authority and is removed
// when those features move to resourceScopeId in phases 8 and 9.
export type SgWorkspace = SgWorkspaceResource & {
  workspaceId: string;
  resourceKind: SgWorkspaceResourceKind;
  parentResourceId?: string;
  title: string;
  status: "active";
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type ResourceScopeStore = {
  version: 2;
  resourceScopes: SgResourceScope[];
};

const emptyStore = (): ResourceScopeStore => ({ version: 2, resourceScopes: [] });
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

const timestamp = (value: unknown): value is string =>
  typeof value === "string" && Boolean(value.trim()) && !Number.isNaN(Date.parse(value));

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

function isResourceScope(value: unknown): value is SgResourceScope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const item = value as Partial<SgResourceScope>;
  const allowedKeys = new Set([
    "resourceScopeId",
    "platform",
    "accountId",
    "resourceKind",
    "resourceId",
    "parentResourceId",
    "topicId",
    "createdAt",
    "updatedAt",
  ]);
  return (
    Object.keys(value).every((key) => allowedKeys.has(key)) &&
    typeof item.resourceScopeId === "string" &&
    Boolean(item.resourceScopeId.trim()) &&
    typeof item.platform === "string" &&
    Boolean(item.platform.trim()) &&
    (item.accountId === undefined ||
      (typeof item.accountId === "string" && Boolean(item.accountId.trim()))) &&
    typeof item.resourceId === "string" &&
    Boolean(item.resourceId.trim()) &&
    ["group", "channel", "room", "topic"].includes(item.resourceKind ?? "") &&
    (item.parentResourceId === undefined ||
      (typeof item.parentResourceId === "string" && Boolean(item.parentResourceId.trim()))) &&
    (item.topicId === undefined ||
      (typeof item.topicId === "string" && Boolean(item.topicId.trim()))) &&
    timestamp(item.createdAt) &&
    timestamp(item.updatedAt)
  );
}

function isResourceScopeStore(value: unknown): value is ResourceScopeStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const store = value as Partial<ResourceScopeStore>;
  if (
    Object.keys(value).some((key) => !["version", "resourceScopes"].includes(key)) ||
    store.version !== 2 ||
    !Array.isArray(store.resourceScopes) ||
    !store.resourceScopes.every(isResourceScope)
  ) {
    return false;
  }
  const resourceKeys = store.resourceScopes.map(workspaceResourceKey);
  const resourceScopeIds = store.resourceScopes.map((scope) => scope.resourceScopeId);
  return (
    new Set(resourceKeys).size === resourceKeys.length &&
    new Set(resourceScopeIds).size === resourceScopeIds.length
  );
}

function compatibilityView(scope: SgResourceScope): SgWorkspace {
  return {
    workspaceId: scope.resourceScopeId,
    platform: scope.platform,
    ...(scope.accountId ? { accountId: scope.accountId } : {}),
    resourceId: scope.resourceId,
    ...(scope.topicId ? { topicId: scope.topicId } : {}),
    resourceKind: scope.resourceKind,
    ...(scope.parentResourceId ? { parentResourceId: scope.parentResourceId } : {}),
    title: `${scope.resourceKind} ${scope.resourceId}`,
    status: "active",
    settings: {},
    createdAt: scope.createdAt,
    updatedAt: scope.updatedAt,
  };
}

export class SgWorkspaceRegistry {
  private readonly filePath: string;

  constructor(stateDir: string) {
    this.filePath = path.join(stateDir, "sg", "workspaces.json");
  }

  private async read(): Promise<ResourceScopeStore> {
    const result = await readJsonFileWithFallback<unknown>(this.filePath, emptyStore());
    if (!result.exists) {
      return emptyStore();
    }
    if (!isResourceScopeStore(result.value)) {
      throw new Error("sg-resource-scope-store-invalid");
    }
    return result.value;
  }

  private async mutate<T>(fn: (store: ResourceScopeStore) => T | Promise<T>): Promise<T> {
    return withFileLock(this.filePath, LOCK_OPTIONS, async () => {
      const store = await this.read();
      const result = await fn(store);
      await writeJsonFileAtomically(this.filePath, store);
      return result;
    });
  }

  async resolve(resource: SgWorkspaceResource): Promise<SgResourceScope | undefined> {
    const key = workspaceResourceKey(resource);
    return (await this.read()).resourceScopes.find((scope) => workspaceResourceKey(scope) === key);
  }

  async resolveWorkspace(resource: SgWorkspaceResource): Promise<SgWorkspace | undefined> {
    const scope = await this.resolve(resource);
    return scope ? compatibilityView(scope) : undefined;
  }

  async findById(resourceScopeId: string): Promise<SgWorkspace | undefined> {
    const normalizedId = resourceScopeId.trim();
    const scope = (await this.read()).resourceScopes.find(
      (candidate) => candidate.resourceScopeId === normalizedId,
    );
    return scope ? compatibilityView(scope) : undefined;
  }

  async list(): Promise<SgResourceScope[]> {
    return structuredClone((await this.read()).resourceScopes);
  }

  async listWorkspaces(): Promise<SgWorkspace[]> {
    return (await this.list()).map(compatibilityView);
  }

  async register(
    input: Omit<SgResourceScope, "resourceScopeId" | "createdAt" | "updatedAt">,
  ): Promise<SgResourceScope> {
    const normalized = normalizeWorkspaceResource(input);
    const key = workspaceResourceKey(normalized);
    return this.mutate((store) => {
      const existing = store.resourceScopes.find((scope) => workspaceResourceKey(scope) === key);
      if (existing) {
        return existing;
      }
      const now = new Date().toISOString();
      const parentResourceId = normalizeOptional(input.parentResourceId);
      const scope: SgResourceScope = {
        ...normalized,
        resourceScopeId: `rscope_${randomUUID()}`,
        resourceKind: input.resourceKind,
        ...(parentResourceId ? { parentResourceId } : {}),
        createdAt: now,
        updatedAt: now,
      };
      store.resourceScopes.push(scope);
      return scope;
    });
  }
}

export function formatWorkspaceResolution(scope: SgResourceScope | undefined): string {
  if (!scope) {
    return "SG Workspace Manager — ресурс не зарегистрирован";
  }
  return [
    "SG Workspace Manager — resource scope",
    `Resource scope ID: ${scope.resourceScopeId}`,
    `Тип: ${scope.resourceKind}`,
    `Ресурс: ${scope.resourceId}`,
  ].join("\n");
}
