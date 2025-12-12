// src/users/permissions.js
// 7.8 Permissions-layer (V1): единая точка контроля доступа

export function can(user, action, ctx = {}) {
  const role = (user?.role || "guest").toLowerCase();
  const bypass = Boolean(user?.bypassPermissions);

  if (bypass) return true; // монарх / технический bypass

  // БАЗОВЫЕ правила V1 (расширим позже)
  // Разрешаем гостю только безопасные команды
  const guestAllow = new Set([
    "cmd.profile",
    "cmd.me",
    "cmd.whoami",
    "cmd.mode",
    "cmd.tasks.list",
    "cmd.task.run",
    "cmd.task.create",
    "cmd.price",
    "cmd.prices",
    "cmd.sources.list",
    "cmd.source.fetch",
    "cmd.source.diagnose",
  ]);

  if (role === "guest") return guestAllow.has(action);

  // пока: всё кроме guest считаем привилегированными
  return true;
}

