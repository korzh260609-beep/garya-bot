import { randomUUID } from "node:crypto";
import path from "node:path";
import { withFileLock } from "openclaw/plugin-sdk/file-lock";
import { readJsonFileWithFallback, writeJsonFileAtomically } from "openclaw/plugin-sdk/json-store";
import { findExistingSgProfileByGlobalId } from "./context.js";
import {
  normalizeWorkspaceResource,
  type SgWorkspaceResource,
  type SgWorkspaceResourceKind,
  type SgWorkspaceRegistry,
  workspaceResourceKey,
} from "./workspace-registry.js";

export type SgWorkspaceRequestStatus = "pending" | "approved" | "rejected";

export type SgWorkspaceRequest = SgWorkspaceResource & {
  requestId: string;
  resourceKind: SgWorkspaceResourceKind;
  title: string;
  initiatorCanonicalIdentity: string;
  initiatorGlobalId?: string;
  ownerGlobalId?: string;
  status: SgWorkspaceRequestStatus;
  authoritySource?: "monarch_confirmation";
  decidedByGlobalId?: string;
  createdAt: string;
  updatedAt: string;
};

type RequestStore = { version: 1; requests: SgWorkspaceRequest[] };
const emptyStore = (): RequestStore => ({ version: 1, requests: [] });
const LOCK_OPTIONS = {
  retries: { retries: 20, factor: 1.2, minTimeout: 10, maxTimeout: 100 },
  stale: 30_000,
  staleRecovery: "fail-closed" as const,
};

const required = (value: string, field: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`sg-workspace-request-${field}-required`);
  }
  return normalized;
};

function isRequest(value: unknown): value is SgWorkspaceRequest {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<SgWorkspaceRequest>;
  return (
    typeof item.requestId === "string" &&
    typeof item.platform === "string" &&
    typeof item.resourceId === "string" &&
    ["group", "channel", "room", "topic"].includes(item.resourceKind ?? "") &&
    typeof item.title === "string" &&
    typeof item.initiatorCanonicalIdentity === "string" &&
    ["pending", "approved", "rejected"].includes(item.status ?? "") &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

function isStore(value: unknown): value is RequestStore {
  if (!value || typeof value !== "object") {
    return false;
  }
  const store = value as Partial<RequestStore>;
  if (store.version !== 1 || !Array.isArray(store.requests) || !store.requests.every(isRequest)) {
    return false;
  }
  return (
    new Set(store.requests.map((request) => request.requestId)).size === store.requests.length &&
    new Set(store.requests.map(workspaceResourceKey)).size === store.requests.length
  );
}

export class SgWorkspaceRequestRegistry {
  private readonly filePath: string;
  private readonly stateDir: string;

  constructor(stateDir: string) {
    this.stateDir = stateDir;
    this.filePath = path.join(stateDir, "sg", "workspace-requests.json");
  }

  private async read(): Promise<RequestStore> {
    const result = await readJsonFileWithFallback<unknown>(this.filePath, emptyStore());
    if (!result.exists) {
      return emptyStore();
    }
    if (!isStore(result.value)) {
      throw new Error("sg-workspace-request-store-invalid");
    }
    return result.value;
  }

  private async mutate<T>(fn: (store: RequestStore) => T | Promise<T>): Promise<T> {
    return withFileLock(this.filePath, LOCK_OPTIONS, async () => {
      const store = await this.read();
      const result = await fn(store);
      await writeJsonFileAtomically(this.filePath, store);
      return result;
    });
  }

  async create(
    input: SgWorkspaceResource & {
      resourceKind: SgWorkspaceResourceKind;
      title: string;
      initiatorCanonicalIdentity: string;
      initiatorGlobalId?: string;
    },
  ): Promise<SgWorkspaceRequest> {
    const resource = normalizeWorkspaceResource(input);
    const key = workspaceResourceKey(resource);
    return this.mutate((store) => {
      const existing = store.requests.find((request) => workspaceResourceKey(request) === key);
      if (existing) {
        return existing;
      }
      const now = new Date().toISOString();
      const request: SgWorkspaceRequest = {
        ...resource,
        requestId: `wreq_${randomUUID()}`,
        resourceKind: input.resourceKind,
        title: required(input.title, "title"),
        initiatorCanonicalIdentity: required(
          input.initiatorCanonicalIdentity,
          "initiator-identity",
        ),
        ...(input.initiatorGlobalId
          ? { initiatorGlobalId: required(input.initiatorGlobalId, "initiator-global-id") }
          : {}),
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };
      store.requests.push(request);
      return request;
    });
  }

  async listPending(): Promise<SgWorkspaceRequest[]> {
    return (await this.read()).requests.filter((request) => request.status === "pending");
  }

  async approve(params: {
    requestId: string;
    decidedByGlobalId: string;
    ownerGlobalId: string;
    workspaces: SgWorkspaceRegistry;
  }) {
    const current = (await this.read()).requests.find(
      (request) => request.requestId === params.requestId,
    );
    if (!current || current.status === "rejected") {
      throw new Error("sg-workspace-request-not-pending");
    }
    const ownerGlobalId = required(params.ownerGlobalId, "owner-global-id");
    if (!(await findExistingSgProfileByGlobalId(ownerGlobalId, this.stateDir))) {
      throw new Error("sg-workspace-owner-profile-not-active");
    }
    const workspace = await params.workspaces.register({
      platform: current.platform,
      ...(current.accountId ? { accountId: current.accountId } : {}),
      resourceId: current.resourceId,
      ...(current.topicId ? { topicId: current.topicId } : {}),
      resourceKind: current.resourceKind,
      title: current.title,
      ownerGlobalId,
      status: "active",
      settings: {},
    });
    const request = await this.mutate((store) => {
      const index = store.requests.findIndex((item) => item.requestId === params.requestId);
      if (index < 0 || store.requests[index]?.status === "rejected") {
        throw new Error("sg-workspace-request-not-pending");
      }
      const updated: SgWorkspaceRequest = {
        ...store.requests[index]!,
        status: "approved",
        ownerGlobalId,
        authoritySource: "monarch_confirmation",
        decidedByGlobalId: required(params.decidedByGlobalId, "decider-global-id"),
        updatedAt: new Date().toISOString(),
      };
      store.requests[index] = updated;
      return updated;
    });
    return { request, workspace };
  }

  async reject(params: { requestId: string; decidedByGlobalId: string }) {
    return this.mutate((store) => {
      const index = store.requests.findIndex((request) => request.requestId === params.requestId);
      if (index < 0 || store.requests[index]?.status !== "pending") {
        throw new Error("sg-workspace-request-not-pending");
      }
      const updated: SgWorkspaceRequest = {
        ...store.requests[index]!,
        status: "rejected",
        decidedByGlobalId: required(params.decidedByGlobalId, "decider-global-id"),
        updatedAt: new Date().toISOString(),
      };
      store.requests[index] = updated;
      return updated;
    });
  }
}
