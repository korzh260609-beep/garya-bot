import { readFile } from "node:fs/promises";
import path from "node:path";

export type SgProjectRole = "guest" | "citizen" | "monarch";
type Profile = { globalId: string; canonicalIdentity: string; role: SgProjectRole; status: "active" | "suspended" | "archived"; createdAt: string; updatedAt: string };
type Identity = { canonicalIdentity: string; globalId: string; createdAt: string; updatedAt: string };
type Store = { version: 2; profiles: Profile[]; identities: Identity[] };
export type SgWorkspaceContextInput = { channel: string; accountId?: string; to?: string; threadParentId?: string; messageThreadId?: string | number; senderId?: string; identityLinks?: Record<string, string[]> };
export type SgWorkspaceContext = { channel: string; accountId?: string; resourceId?: string; topicId?: string; senderId?: string; canonicalIdentity?: string; globalId?: string; projectRole: SgProjectRole };

const normalize = (value: string | undefined) => (value ?? "").trim().toLowerCase();
const defaultStateDir = () => process.env.OPENCLAW_STATE_DIR?.trim() || "/data/.openclaw";
const storePath = (root: string) => path.join(root, "sg", "global-profiles.json");

export function resolveSgCanonicalIdentity(params: { channel: string; senderId: string; identityLinks?: Record<string, string[]> }): string | undefined {
  const channel = normalize(params.channel);
  const senderId = normalize(params.senderId);
  if (!channel || !senderId) return undefined;
  const candidates = new Set([senderId, `${channel}:${senderId}`]);
  const links = Object.entries(params.identityLinks ?? {}).filter(([, ids]) => ids.some((id) => candidates.has(normalize(id)))).map(([name]) => normalize(name));
  if (new Set(links).size > 1) return undefined;
  return links[0] ? `linked:${links[0]}` : `channel:${channel}:${senderId}`;
}

function validStore(value: unknown): value is Store {
  if (!value || typeof value !== "object") return false;
  const store = value as Partial<Store>;
  if (store.version !== 2 || !Array.isArray(store.profiles) || !Array.isArray(store.identities)) return false;
  const profileIds = new Set<string>();
  for (const profile of store.profiles) {
    if (!profile || typeof profile.globalId !== "string" || typeof profile.canonicalIdentity !== "string" || !["guest", "citizen", "monarch"].includes(profile.role) || !["active", "suspended", "archived"].includes(profile.status) || profileIds.has(profile.globalId)) return false;
    profileIds.add(profile.globalId);
  }
  const identities = new Set<string>();
  return store.identities.every((identity) => {
    if (!identity || typeof identity.canonicalIdentity !== "string" || typeof identity.globalId !== "string" || identities.has(identity.canonicalIdentity) || !profileIds.has(identity.globalId)) return false;
    identities.add(identity.canonicalIdentity);
    return true;
  });
}

async function readStore(root: string): Promise<Store | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(storePath(root), "utf8"));
    if (!validStore(parsed)) throw new Error("sg-global-profile-store-invalid");
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function findExistingSgProfile(canonicalIdentity: string, root = defaultStateDir()): Promise<Profile | undefined> {
  const store = await readStore(root);
  const link = store?.identities.find((item) => item.canonicalIdentity === canonicalIdentity);
  const profile = link ? store?.profiles.find((item) => item.globalId === link.globalId) : undefined;
  return profile?.status === "active" ? profile : undefined;
}

export async function resolveWorkspaceContext(ctx: SgWorkspaceContextInput, root = defaultStateDir()): Promise<SgWorkspaceContext> {
  const canonicalIdentity = ctx.senderId ? resolveSgCanonicalIdentity({ channel: ctx.channel, senderId: ctx.senderId, identityLinks: ctx.identityLinks }) : undefined;
  const profile = canonicalIdentity ? await findExistingSgProfile(canonicalIdentity, root) : undefined;
  return { channel: ctx.channel, ...(ctx.accountId ? { accountId: ctx.accountId } : {}), ...(ctx.threadParentId || ctx.to ? { resourceId: ctx.threadParentId ?? ctx.to } : {}), ...(ctx.messageThreadId !== undefined ? { topicId: String(ctx.messageThreadId) } : {}), ...(ctx.senderId ? { senderId: ctx.senderId } : {}), ...(canonicalIdentity ? { canonicalIdentity } : {}), ...(profile ? { globalId: profile.globalId } : {}), projectRole: profile?.role ?? "guest" };
}

export function formatWorkspaceContext(context: SgWorkspaceContext): string {
  return ["SG Workspace Manager — WSP1 (read-only)", `Global ID: ${context.globalId ?? "не найден"}`, `Роль SG: ${context.projectRole}`, `Канал: ${context.channel}`, `Аккаунт: ${context.accountId ?? "default"}`, `Ресурс: ${context.resourceId ?? "не определён"}`, `Тема: ${context.topicId ?? "нет"}`].join("\n");
}
