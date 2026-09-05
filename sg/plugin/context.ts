import {
  SgGlobalProfileRegistry,
  type SgGlobalProfile,
  type SgProjectRole,
} from "./citizenship-registry.js";
import { resolvePersonalWorkspaceRoot } from "./personal-workspace.js";

export type { SgProjectRole } from "./citizenship-registry.js";
export type SgWorkspaceContextInput = {
  channel: string;
  accountId?: string;
  to?: string;
  threadParentId?: string;
  messageThreadId?: string | number;
  senderId?: string;
  identityLinks?: Record<string, string[]>;
};
export type SgWorkspaceContext = {
  channel: string;
  accountId?: string;
  resourceId?: string;
  topicId?: string;
  senderId?: string;
  canonicalIdentity?: string;
  globalId?: string;
  projectRole?: SgProjectRole;
  personalWorkspaceId?: string;
  personalWorkspaceRoot?: string;
};

const normalize = (value: string | undefined) => (value ?? "").trim().toLowerCase();
const defaultStateDir = () => process.env.OPENCLAW_STATE_DIR?.trim() || "/data/.openclaw";

export function resolveSgCanonicalIdentity(params: {
  channel: string;
  senderId: string;
  identityLinks?: Record<string, string[]>;
}): string | undefined {
  const channel = normalize(params.channel);
  const senderId = normalize(params.senderId);
  if (!channel || !senderId) return undefined;
  const candidates = new Set([senderId, `${channel}:${senderId}`]);
  const links = Object.entries(params.identityLinks ?? {})
    .filter(([, ids]) => ids.some((id) => candidates.has(normalize(id))))
    .map(([name]) => normalize(name));
  if (new Set(links).size > 1) return undefined;
  return links[0] ? `linked:${links[0]}` : `channel:${channel}:${senderId}`;
}

export async function findExistingSgProfile(
  canonicalIdentity: string,
  root = defaultStateDir(),
): Promise<SgGlobalProfile | undefined> {
  return new SgGlobalProfileRegistry(root).findByCanonicalIdentity(canonicalIdentity);
}

export async function findExistingSgProfileByGlobalId(
  globalId: string,
  root = defaultStateDir(),
): Promise<SgGlobalProfile | undefined> {
  return new SgGlobalProfileRegistry(root).findByGlobalId(globalId);
}

export async function ensureSgProfile(
  canonicalIdentity: string,
  root = defaultStateDir(),
): Promise<SgGlobalProfile> {
  return new SgGlobalProfileRegistry(root).ensureProfile(canonicalIdentity);
}

export async function resolveWorkspaceContext(
  ctx: SgWorkspaceContextInput,
  root = defaultStateDir(),
): Promise<SgWorkspaceContext> {
  const canonicalIdentity = ctx.senderId
    ? resolveSgCanonicalIdentity({
        channel: ctx.channel,
        senderId: ctx.senderId,
        identityLinks: ctx.identityLinks,
      })
    : undefined;
  const profile = canonicalIdentity ? await ensureSgProfile(canonicalIdentity, root) : undefined;
  return {
    channel: ctx.channel,
    ...(ctx.accountId ? { accountId: ctx.accountId } : {}),
    ...(ctx.threadParentId || ctx.to ? { resourceId: ctx.threadParentId ?? ctx.to } : {}),
    ...(ctx.messageThreadId !== undefined ? { topicId: String(ctx.messageThreadId) } : {}),
    ...(ctx.senderId ? { senderId: ctx.senderId } : {}),
    ...(canonicalIdentity ? { canonicalIdentity } : {}),
    ...(profile ? { globalId: profile.globalId } : {}),
    ...(profile?.role === "monarch" || profile?.role === "citizen"
      ? { projectRole: profile.role }
      : {}),
    ...(profile
      ? {
          personalWorkspaceId: profile.globalId,
          personalWorkspaceRoot: resolvePersonalWorkspaceRoot(root, profile.globalId),
        }
      : {}),
  };
}

export function formatWorkspaceContext(context: SgWorkspaceContext): string {
  return [
    "SG Workspace Manager — WSP1 (read-only)",
    `Global ID: ${context.globalId ?? "не найден"}`,
    `Роль SG: ${context.projectRole ?? "не определена"}`,
    `Канал: ${context.channel}`,
    `Аккаунт: ${context.accountId ?? "default"}`,
    `Ресурс: ${context.resourceId ?? "не определён"}`,
    `Тема: ${context.topicId ?? "нет"}`,
  ].join("\n");
}
