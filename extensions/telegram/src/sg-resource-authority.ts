import type { ChatMember } from "grammy/types";

export type TelegramSgResourceAuthority = {
  resourceId: string;
  resourceRole: "creator" | "administrator" | "member" | "outsider" | "unknown";
  verified: boolean;
};

const TTL_MS = 120_000;
const cache = new Map<string, { value: TelegramSgResourceAuthority; expiresAt: number }>();

function roleFor(member: ChatMember): TelegramSgResourceAuthority["resourceRole"] {
  if (member.status === "creator") return "creator";
  if (member.status === "administrator") return "administrator";
  if (member.status === "member" || (member.status === "restricted" && member.is_member)) return "member";
  if (member.status === "left" || member.status === "kicked") return "outsider";
  return "unknown";
}

export async function resolveTelegramSgResourceAuthority(params: {
  chatId: string | number;
  senderId: string;
  isGroup: boolean;
  getChatMember: (chatId: string | number, userId: number) => Promise<ChatMember>;
  fresh?: boolean;
}): Promise<TelegramSgResourceAuthority> {
  const resourceId = `telegram:${String(params.chatId)}`;
  if (!params.isGroup) return { resourceId, resourceRole: "member", verified: true };
  const userId = Number(params.senderId);
  if (!Number.isSafeInteger(userId)) return { resourceId, resourceRole: "unknown", verified: false };
  const key = `${String(params.chatId)}:${params.senderId}`;
  const cached = cache.get(key);
  if (!params.fresh && cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    const member = await params.getChatMember(params.chatId, userId);
    const value = { resourceId, resourceRole: roleFor(member), verified: true } as const;
    cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
    return value;
  } catch {
    return { resourceId, resourceRole: "unknown", verified: false };
  }
}

export function invalidateTelegramSgResourceAuthority(chatId: string | number, senderId?: string | number): void {
  if (senderId !== undefined) {
    cache.delete(`${String(chatId)}:${String(senderId)}`);
    return;
  }
  const prefix = `${String(chatId)}:`;
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
}
