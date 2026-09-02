import { randomUUID } from "node:crypto";
import path from "node:path";
import { withFileLock } from "openclaw/plugin-sdk/file-lock";
import { readJsonFileWithFallback, writeJsonFileAtomically } from "openclaw/plugin-sdk/json-store";

export type SgContentMediaType = "image" | "audio" | "video" | "file";
export type SgContentMediaReference = {
  media: string;
  type?: SgContentMediaType;
  name?: string;
  mimeType?: string;
};
export type SgEditorialStatus = "draft" | "pending" | "approved" | "rejected";
export type SgDeliveryStatus =
  | "none"
  | "publishing"
  | "published"
  | "scheduling"
  | "scheduled"
  | "rescheduling"
  | "cancelling"
  | "cancelled"
  | "failed";

export type SgContentDraft = {
  draftId: string;
  workspaceId: string;
  topicId?: string;
  creatorGlobalId: string;
  text?: string;
  media: SgContentMediaReference[];
  highImpact: boolean;
  revision: number;
  editorialStatus: SgEditorialStatus;
  deliveryStatus: SgDeliveryStatus;
  approvedByGlobalId?: string;
  approvedAt?: string;
  rejectedByGlobalId?: string;
  rejectedAt?: string;
  scheduledAt?: string;
  pendingScheduledAt?: string;
  automationJobId?: string;
  dispatchToken?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

export type SgPublicationRecord = {
  publicationId: string;
  operationId: string;
  draftId: string;
  workspaceId: string;
  revision: number;
  mode: "now" | "scheduled";
  platform: string;
  target: string;
  topicId?: string;
  nativeResultId?: string;
  status: "published" | "failed";
  error?: string;
  createdAt: string;
};

export type SgContentAuditAction =
  | "create"
  | "update"
  | "submit"
  | "approve"
  | "reject"
  | "publish_request"
  | "publish_success"
  | "publish_failure"
  | "schedule_request"
  | "schedule_success"
  | "schedule_failure"
  | "reschedule_request"
  | "reschedule_success"
  | "reschedule_failure"
  | "cancel_request"
  | "cancel_success"
  | "cancel_failure"
  | "scheduled_dispatch";

export type SgContentAuditEvent = {
  eventId: string;
  operationId: string;
  action: SgContentAuditAction;
  draftId: string;
  workspaceId: string;
  actorGlobalId: string;
  fromEditorial: SgEditorialStatus;
  toEditorial: SgEditorialStatus;
  fromDelivery: SgDeliveryStatus;
  toDelivery: SgDeliveryStatus;
  detail?: string;
  createdAt: string;
};

export type SgContentStore = {
  version: 1;
  drafts: SgContentDraft[];
  publications: SgPublicationRecord[];
  audit: SgContentAuditEvent[];
};

export type SgContentNativeOperation =
  | { kind: "publish"; draftId: string; operationId: string; mode: "now" | "scheduled" }
  | { kind: "schedule"; draftId: string; operationId: string }
  | { kind: "reschedule"; draftId: string; operationId: string }
  | { kind: "cancel"; draftId: string; operationId: string };

const emptyStore = (): SgContentStore => ({ version: 1, drafts: [], publications: [], audit: [] });
const LOCK_OPTIONS = {
  retries: { retries: 20, factor: 1.2, minTimeout: 10, maxTimeout: 100 },
  stale: 30_000,
  staleRecovery: "fail-closed" as const,
};

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && Boolean(value.trim());
const timestamp = (value: unknown): value is string =>
  nonEmpty(value) && !Number.isNaN(Date.parse(value));
const optionalText = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === "string";
const editorialStatuses: ReadonlySet<SgEditorialStatus> = new Set([
  "draft",
  "pending",
  "approved",
  "rejected",
]);
const deliveryStatuses: ReadonlySet<SgDeliveryStatus> = new Set([
  "none",
  "publishing",
  "published",
  "scheduling",
  "scheduled",
  "rescheduling",
  "cancelling",
  "cancelled",
  "failed",
]);

function validMedia(value: unknown): value is SgContentMediaReference {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<SgContentMediaReference>;
  return (
    nonEmpty(item.media) &&
    (item.type === undefined || ["image", "audio", "video", "file"].includes(item.type)) &&
    (item.name === undefined || nonEmpty(item.name)) &&
    (item.mimeType === undefined || nonEmpty(item.mimeType))
  );
}

function validDraft(value: unknown): value is SgContentDraft {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<SgContentDraft>;
  return (
    nonEmpty(item.draftId) &&
    nonEmpty(item.workspaceId) &&
    nonEmpty(item.creatorGlobalId) &&
    optionalText(item.text) &&
    (nonEmpty(item.text) || (Array.isArray(item.media) && item.media.length > 0)) &&
    Array.isArray(item.media) &&
    item.media.length <= 10 &&
    item.media.every(validMedia) &&
    typeof item.highImpact === "boolean" &&
    Number.isInteger(item.revision) &&
    Number(item.revision) > 0 &&
    editorialStatuses.has(item.editorialStatus as SgEditorialStatus) &&
    deliveryStatuses.has(item.deliveryStatus as SgDeliveryStatus) &&
    (item.topicId === undefined || nonEmpty(item.topicId)) &&
    (item.approvedByGlobalId === undefined || nonEmpty(item.approvedByGlobalId)) &&
    (item.approvedAt === undefined || timestamp(item.approvedAt)) &&
    (item.rejectedByGlobalId === undefined || nonEmpty(item.rejectedByGlobalId)) &&
    (item.rejectedAt === undefined || timestamp(item.rejectedAt)) &&
    (item.scheduledAt === undefined || timestamp(item.scheduledAt)) &&
    (item.pendingScheduledAt === undefined || timestamp(item.pendingScheduledAt)) &&
    (item.automationJobId === undefined || nonEmpty(item.automationJobId)) &&
    (item.dispatchToken === undefined || nonEmpty(item.dispatchToken)) &&
    (item.lastError === undefined || nonEmpty(item.lastError)) &&
    timestamp(item.createdAt) &&
    timestamp(item.updatedAt)
  );
}

function validPublication(value: unknown): value is SgPublicationRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<SgPublicationRecord>;
  return (
    nonEmpty(item.publicationId) &&
    nonEmpty(item.operationId) &&
    nonEmpty(item.draftId) &&
    nonEmpty(item.workspaceId) &&
    Number.isInteger(item.revision) &&
    ["now", "scheduled"].includes(item.mode ?? "") &&
    nonEmpty(item.platform) &&
    nonEmpty(item.target) &&
    (item.topicId === undefined || nonEmpty(item.topicId)) &&
    (item.nativeResultId === undefined || nonEmpty(item.nativeResultId)) &&
    ["published", "failed"].includes(item.status ?? "") &&
    (item.error === undefined || nonEmpty(item.error)) &&
    timestamp(item.createdAt)
  );
}

function validAudit(value: unknown): value is SgContentAuditEvent {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<SgContentAuditEvent>;
  return (
    nonEmpty(item.eventId) &&
    nonEmpty(item.operationId) &&
    nonEmpty(item.action) &&
    nonEmpty(item.draftId) &&
    nonEmpty(item.workspaceId) &&
    nonEmpty(item.actorGlobalId) &&
    editorialStatuses.has(item.fromEditorial as SgEditorialStatus) &&
    editorialStatuses.has(item.toEditorial as SgEditorialStatus) &&
    deliveryStatuses.has(item.fromDelivery as SgDeliveryStatus) &&
    deliveryStatuses.has(item.toDelivery as SgDeliveryStatus) &&
    (item.detail === undefined || nonEmpty(item.detail)) &&
    timestamp(item.createdAt)
  );
}

export function validateContentStore(value: unknown): value is SgContentStore {
  if (!value || typeof value !== "object") {
    return false;
  }
  const store = value as Partial<SgContentStore>;
  if (
    store.version !== 1 ||
    !Array.isArray(store.drafts) ||
    !store.drafts.every(validDraft) ||
    !Array.isArray(store.publications) ||
    !store.publications.every(validPublication) ||
    !Array.isArray(store.audit) ||
    !store.audit.every(validAudit)
  ) {
    return false;
  }
  const draftIds = store.drafts.map((item) => item.draftId);
  const publicationIds = store.publications.map((item) => item.publicationId);
  const eventIds = store.audit.map((item) => item.eventId);
  const draftIdSet = new Set(draftIds);
  return (
    new Set(draftIds).size === draftIds.length &&
    new Set(publicationIds).size === publicationIds.length &&
    new Set(eventIds).size === eventIds.length &&
    store.publications.every((item) => draftIdSet.has(item.draftId)) &&
    store.audit.every((item) => draftIdSet.has(item.draftId)) &&
    store.drafts.every((item) =>
      item.deliveryStatus === "scheduled"
        ? Boolean(item.scheduledAt && item.automationJobId && item.dispatchToken)
        : item.deliveryStatus === "cancelled"
          ? !item.automationJobId && !item.dispatchToken
          : true,
    )
  );
}

function requireDraft(store: SgContentStore, draftId: string): SgContentDraft {
  const draft = store.drafts.find((item) => item.draftId === draftId.trim());
  if (!draft) {
    throw new Error("sg-content-draft-not-found");
  }
  return draft;
}

function assertEditableDelivery(draft: SgContentDraft): void {
  if (
    ["publishing", "scheduling", "scheduled", "rescheduling", "cancelling"].includes(
      draft.deliveryStatus,
    )
  ) {
    throw new Error("sg-content-draft-delivery-active");
  }
}

function assertApproved(draft: SgContentDraft): void {
  if (draft.editorialStatus !== "approved") {
    throw new Error("sg-content-approval-required");
  }
}

function operationId(): string {
  return `op_${randomUUID()}`;
}

function clearReviewFields(draft: SgContentDraft): SgContentDraft {
  const cleared = { ...draft };
  delete cleared.approvedByGlobalId;
  delete cleared.approvedAt;
  delete cleared.rejectedByGlobalId;
  delete cleared.rejectedAt;
  return cleared;
}

function pushAudit(
  store: SgContentStore,
  before: SgContentDraft,
  after: SgContentDraft,
  action: SgContentAuditAction,
  actorGlobalId: string,
  id: string,
  detail?: string,
): void {
  store.audit.push({
    eventId: `contevt_${randomUUID()}`,
    operationId: id,
    action,
    draftId: after.draftId,
    workspaceId: after.workspaceId,
    actorGlobalId,
    fromEditorial: before.editorialStatus,
    toEditorial: after.editorialStatus,
    fromDelivery: before.deliveryStatus,
    toDelivery: after.deliveryStatus,
    ...(detail ? { detail } : {}),
    createdAt: after.updatedAt,
  });
}

export class SgContentRegistry {
  private readonly filePath: string;

  constructor(stateDir: string) {
    this.filePath = path.join(stateDir, "sg", "content.json");
  }

  private async read(): Promise<SgContentStore> {
    const result = await readJsonFileWithFallback<unknown>(this.filePath, emptyStore());
    if (!result.exists) {
      return emptyStore();
    }
    if (!validateContentStore(result.value)) {
      throw new Error("sg-content-store-invalid");
    }
    return result.value;
  }

  private async mutate<T>(fn: (store: SgContentStore) => T | Promise<T>): Promise<T> {
    return withFileLock(this.filePath, LOCK_OPTIONS, async () => {
      const store = await this.read();
      const result = await fn(store);
      await writeJsonFileAtomically(this.filePath, store);
      return result;
    });
  }

  async snapshot(): Promise<SgContentStore> {
    return structuredClone(await this.read());
  }

  async findDraft(draftId: string): Promise<SgContentDraft | undefined> {
    return structuredClone(
      (await this.read()).drafts.find((item) => item.draftId === draftId.trim()),
    );
  }

  async create(input: {
    workspaceId: string;
    topicId?: string;
    creatorGlobalId: string;
    text?: string;
    media: SgContentMediaReference[];
    highImpact: boolean;
  }): Promise<SgContentDraft> {
    const text = input.text?.trim() || undefined;
    if (!text && input.media.length === 0) {
      throw new Error("sg-content-body-required");
    }
    if (input.media.length > 10 || !input.media.every(validMedia)) {
      throw new Error("sg-content-media-invalid");
    }
    return this.mutate((store) => {
      const now = new Date().toISOString();
      const draft: SgContentDraft = {
        draftId: `draft_${randomUUID()}`,
        workspaceId: input.workspaceId.trim(),
        ...(input.topicId?.trim() ? { topicId: input.topicId.trim() } : {}),
        creatorGlobalId: input.creatorGlobalId.trim(),
        ...(text ? { text } : {}),
        media: structuredClone(input.media),
        highImpact: input.highImpact,
        revision: 1,
        editorialStatus: "draft",
        deliveryStatus: "none",
        createdAt: now,
        updatedAt: now,
      };
      store.drafts.push(draft);
      pushAudit(store, draft, draft, "create", input.creatorGlobalId, operationId());
      return structuredClone(draft);
    });
  }

  async update(input: {
    draftId: string;
    actorGlobalId: string;
    canManage: boolean;
    text?: string;
    media?: SgContentMediaReference[];
    topicId?: string | null;
    highImpact?: boolean;
  }): Promise<SgContentDraft> {
    return this.mutate((store) => {
      const current = requireDraft(store, input.draftId);
      assertEditableDelivery(current);
      if (!input.canManage && current.creatorGlobalId !== input.actorGlobalId.trim()) {
        throw new Error("sg-content-own-draft-required");
      }
      const text = input.text === undefined ? current.text : input.text.trim() || undefined;
      const media = input.media === undefined ? current.media : input.media;
      if (!text && media.length === 0) {
        throw new Error("sg-content-body-required");
      }
      if (media.length > 10 || !media.every(validMedia)) {
        throw new Error("sg-content-media-invalid");
      }
      const now = new Date().toISOString();
      const editable = clearReviewFields(current);
      const updated: SgContentDraft = {
        ...editable,
        ...(text ? { text } : { text: undefined }),
        media: structuredClone(media),
        topicId:
          input.topicId === undefined
            ? current.topicId
            : input.topicId === null
              ? undefined
              : input.topicId.trim() || undefined,
        highImpact: input.highImpact ?? current.highImpact,
        revision: current.revision + 1,
        editorialStatus: "draft",
        deliveryStatus: "none",
        lastError: undefined,
        updatedAt: now,
      };
      const index = store.drafts.indexOf(current);
      store.drafts[index] = updated;
      pushAudit(store, current, updated, "update", input.actorGlobalId, operationId());
      return structuredClone(updated);
    });
  }

  async submit(
    draftId: string,
    actorGlobalId: string,
    canManage: boolean,
  ): Promise<SgContentDraft> {
    return this.mutate((store) => {
      const current = requireDraft(store, draftId);
      assertEditableDelivery(current);
      if (!canManage && current.creatorGlobalId !== actorGlobalId.trim()) {
        throw new Error("sg-content-own-draft-required");
      }
      if (current.editorialStatus === "approved") {
        return structuredClone(current);
      }
      const updated = {
        ...current,
        editorialStatus: "pending" as const,
        updatedAt: new Date().toISOString(),
      };
      store.drafts[store.drafts.indexOf(current)] = updated;
      pushAudit(store, current, updated, "submit", actorGlobalId, operationId());
      return structuredClone(updated);
    });
  }

  async review(input: {
    draftId: string;
    actorGlobalId: string;
    decision: "approve" | "reject";
  }): Promise<SgContentDraft> {
    return this.mutate((store) => {
      const current = requireDraft(store, input.draftId);
      assertEditableDelivery(current);
      if (current.editorialStatus !== "pending") {
        throw new Error("sg-content-review-pending-required");
      }
      const now = new Date().toISOString();
      const reviewed = clearReviewFields(current);
      const updated: SgContentDraft =
        input.decision === "approve"
          ? {
              ...reviewed,
              editorialStatus: "approved",
              approvedByGlobalId: input.actorGlobalId.trim(),
              approvedAt: now,
              updatedAt: now,
            }
          : {
              ...reviewed,
              editorialStatus: "rejected",
              rejectedByGlobalId: input.actorGlobalId.trim(),
              rejectedAt: now,
              updatedAt: now,
            };
      store.drafts[store.drafts.indexOf(current)] = updated;
      pushAudit(store, current, updated, input.decision, input.actorGlobalId, operationId());
      return structuredClone(updated);
    });
  }

  async beginPublish(
    draftId: string,
    actorGlobalId: string,
    approveForPublication = false,
  ): Promise<SgContentNativeOperation> {
    return this.mutate((store) => {
      const current = requireDraft(store, draftId);
      assertEditableDelivery(current);
      const id = operationId();
      if (!approveForPublication) {
        assertApproved(current);
      }
      const now = new Date().toISOString();
      const approved: SgContentDraft =
        current.editorialStatus === "approved"
          ? current
          : {
              ...clearReviewFields(current),
              editorialStatus: "approved",
              approvedByGlobalId: actorGlobalId.trim(),
              approvedAt: now,
              updatedAt: now,
            };
      if (approved !== current) {
        store.drafts[store.drafts.indexOf(current)] = approved;
        pushAudit(store, current, approved, "approve", actorGlobalId, id);
      }
      const updated = {
        ...approved,
        deliveryStatus: "publishing" as const,
        lastError: undefined,
        updatedAt: now,
      };
      store.drafts[store.drafts.indexOf(approved)] = updated;
      pushAudit(store, approved, updated, "publish_request", actorGlobalId, id);
      return { kind: "publish", draftId: current.draftId, operationId: id, mode: "now" };
    });
  }

  async beginSchedule(input: {
    draftId: string;
    actorGlobalId: string;
    at: string;
  }): Promise<{ operation: SgContentNativeOperation; dispatchToken: string }> {
    const at = new Date(input.at).toISOString();
    if (Date.parse(at) <= Date.now()) {
      throw new Error("sg-content-schedule-must-be-future");
    }
    return this.mutate((store) => {
      const current = requireDraft(store, input.draftId);
      assertApproved(current);
      assertEditableDelivery(current);
      const id = operationId();
      const dispatchToken = `dispatch_${randomUUID()}`;
      const updated = {
        ...current,
        deliveryStatus: "scheduling" as const,
        pendingScheduledAt: at,
        dispatchToken,
        lastError: undefined,
        updatedAt: new Date().toISOString(),
      };
      store.drafts[store.drafts.indexOf(current)] = updated;
      pushAudit(store, current, updated, "schedule_request", input.actorGlobalId, id, at);
      return {
        operation: { kind: "schedule", draftId: current.draftId, operationId: id },
        dispatchToken,
      };
    });
  }

  async beginReschedule(input: {
    draftId: string;
    actorGlobalId: string;
    at: string;
  }): Promise<{ operation: SgContentNativeOperation; jobId: string }> {
    const at = new Date(input.at).toISOString();
    if (Date.parse(at) <= Date.now()) {
      throw new Error("sg-content-schedule-must-be-future");
    }
    return this.mutate((store) => {
      const current = requireDraft(store, input.draftId);
      if (current.deliveryStatus !== "scheduled" || !current.automationJobId) {
        throw new Error("sg-content-active-schedule-required");
      }
      const id = operationId();
      const updated = {
        ...current,
        deliveryStatus: "rescheduling" as const,
        pendingScheduledAt: at,
        lastError: undefined,
        updatedAt: new Date().toISOString(),
      };
      store.drafts[store.drafts.indexOf(current)] = updated;
      pushAudit(store, current, updated, "reschedule_request", input.actorGlobalId, id, at);
      return {
        operation: { kind: "reschedule", draftId: current.draftId, operationId: id },
        jobId: current.automationJobId,
      };
    });
  }

  async beginCancel(
    draftId: string,
    actorGlobalId: string,
  ): Promise<{ operation: SgContentNativeOperation; jobId: string }> {
    return this.mutate((store) => {
      const current = requireDraft(store, draftId);
      if (current.deliveryStatus !== "scheduled" || !current.automationJobId) {
        throw new Error("sg-content-active-schedule-required");
      }
      const id = operationId();
      const updated = {
        ...current,
        deliveryStatus: "cancelling" as const,
        lastError: undefined,
        updatedAt: new Date().toISOString(),
      };
      store.drafts[store.drafts.indexOf(current)] = updated;
      pushAudit(store, current, updated, "cancel_request", actorGlobalId, id);
      return {
        operation: { kind: "cancel", draftId: current.draftId, operationId: id },
        jobId: current.automationJobId,
      };
    });
  }

  async beginScheduledDispatch(
    draftId: string,
    dispatchToken: string,
  ): Promise<SgContentNativeOperation> {
    return this.mutate((store) => {
      const current = requireDraft(store, draftId);
      if (
        current.deliveryStatus !== "scheduled" ||
        !current.dispatchToken ||
        current.dispatchToken !== dispatchToken.trim()
      ) {
        throw new Error("sg-content-scheduled-dispatch-denied");
      }
      const id = operationId();
      const updated = {
        ...current,
        deliveryStatus: "publishing" as const,
        updatedAt: new Date().toISOString(),
      };
      store.drafts[store.drafts.indexOf(current)] = updated;
      pushAudit(store, current, updated, "scheduled_dispatch", "system:automation", id);
      return { kind: "publish", draftId: current.draftId, operationId: id, mode: "scheduled" };
    });
  }

  async finishNative(input: {
    operation: SgContentNativeOperation;
    success: boolean;
    actorGlobalId: string;
    platform?: string;
    target?: string;
    topicId?: string;
    nativeResultId?: string;
    automationJobId?: string;
    error?: string;
  }): Promise<SgContentDraft> {
    return this.mutate((store) => {
      const current = requireDraft(store, input.operation.draftId);
      const now = new Date().toISOString();
      let updated: SgContentDraft;
      let action: SgContentAuditAction;
      if (input.operation.kind === "publish") {
        updated = {
          ...current,
          deliveryStatus: input.success ? "published" : "failed",
          automationJobId:
            input.operation.mode === "scheduled" ? undefined : current.automationJobId,
          dispatchToken: input.operation.mode === "scheduled" ? undefined : current.dispatchToken,
          lastError: input.success ? undefined : (input.error ?? "native-message-failed"),
          updatedAt: now,
        };
        action = input.success ? "publish_success" : "publish_failure";
        if (input.platform && input.target) {
          store.publications.push({
            publicationId: `pub_${randomUUID()}`,
            operationId: input.operation.operationId,
            draftId: current.draftId,
            workspaceId: current.workspaceId,
            revision: current.revision,
            mode: input.operation.mode,
            platform: input.platform,
            target: input.target,
            ...(input.topicId ? { topicId: input.topicId } : {}),
            ...(input.nativeResultId ? { nativeResultId: input.nativeResultId } : {}),
            status: input.success ? "published" : "failed",
            ...(input.success ? {} : { error: input.error ?? "native-message-failed" }),
            createdAt: now,
          });
        }
      } else if (input.operation.kind === "schedule") {
        const verified = input.success && Boolean(input.automationJobId);
        updated = {
          ...current,
          deliveryStatus: verified ? "scheduled" : "failed",
          scheduledAt: verified ? current.pendingScheduledAt : undefined,
          pendingScheduledAt: undefined,
          automationJobId: verified ? input.automationJobId : undefined,
          dispatchToken: verified ? current.dispatchToken : undefined,
          lastError: verified ? undefined : (input.error ?? "native-automation-id-missing"),
          updatedAt: now,
        };
        action = verified ? "schedule_success" : "schedule_failure";
      } else if (input.operation.kind === "reschedule") {
        updated = {
          ...current,
          deliveryStatus: "scheduled",
          scheduledAt: input.success ? current.pendingScheduledAt : current.scheduledAt,
          pendingScheduledAt: undefined,
          lastError: input.success ? undefined : (input.error ?? "native-automation-failed"),
          updatedAt: now,
        };
        action = input.success ? "reschedule_success" : "reschedule_failure";
      } else {
        updated = input.success
          ? {
              ...current,
              deliveryStatus: "cancelled",
              scheduledAt: undefined,
              pendingScheduledAt: undefined,
              automationJobId: undefined,
              dispatchToken: undefined,
              lastError: undefined,
              updatedAt: now,
            }
          : {
              ...current,
              deliveryStatus: "scheduled",
              lastError: input.error ?? "native-automation-failed",
              updatedAt: now,
            };
        action = input.success ? "cancel_success" : "cancel_failure";
      }
      store.drafts[store.drafts.indexOf(current)] = updated;
      pushAudit(
        store,
        current,
        updated,
        action,
        input.actorGlobalId,
        input.operation.operationId,
        input.error,
      );
      return structuredClone(updated);
    });
  }
}
