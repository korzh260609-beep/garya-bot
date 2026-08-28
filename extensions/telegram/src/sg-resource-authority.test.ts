import { describe, expect, it, vi } from "vitest";
import { invalidateTelegramSgResourceAuthority, resolveTelegramSgResourceAuthority } from "./sg-resource-authority.js";

describe("SG Telegram resource authority", () => {
  it.each([
    ["creator", "creator"],
    ["administrator", "administrator"],
    ["member", "member"],
    ["left", "outsider"],
    ["kicked", "outsider"],
  ] as const)("maps Telegram %s to %s", async (status, expected) => {
    const getChatMember = vi.fn(async () => ({ status, user: { id: 42, is_bot: false, first_name: "A" } }) as never);
    const result = await resolveTelegramSgResourceAuthority({ chatId: -1001, senderId: "42", isGroup: true, getChatMember, fresh: true });
    expect(result).toEqual({ resourceId: "telegram:-1001", resourceRole: expected, verified: true });
  });

  it("fails closed when Telegram cannot verify membership", async () => {
    const result = await resolveTelegramSgResourceAuthority({ chatId: -1002, senderId: "42", isGroup: true, getChatMember: vi.fn(async () => { throw new Error("offline"); }), fresh: true });
    expect(result).toEqual({ resourceId: "telegram:-1002", resourceRole: "unknown", verified: false });
  });

  it("uses a short cache and invalidates it on membership updates", async () => {
    const getChatMember = vi.fn(async () => ({ status: "member", user: { id: 43, is_bot: false, first_name: "B" } }) as never);
    await resolveTelegramSgResourceAuthority({ chatId: -1003, senderId: "43", isGroup: true, getChatMember });
    await resolveTelegramSgResourceAuthority({ chatId: -1003, senderId: "43", isGroup: true, getChatMember });
    expect(getChatMember).toHaveBeenCalledTimes(1);
    invalidateTelegramSgResourceAuthority(-1003, 43);
    await resolveTelegramSgResourceAuthority({ chatId: -1003, senderId: "43", isGroup: true, getChatMember });
    expect(getChatMember).toHaveBeenCalledTimes(2);
  });
});
