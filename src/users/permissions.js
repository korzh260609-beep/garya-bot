// ============================================================================
// === permissions.js — Permissions-layer V1.1 ================================
// Единая точка контроля доступа (commands + sources)
// ============================================================================

export function can(user, action, ctx = {}) {
  const role = (user?.role || "guest").toLowerCase();
  const plan = (user?.plan || "free").toLowerCase();
  const bypass = Boolean(user?.bypassPermissions);

  // --------------------------------------------------------------------------
  // MONARCH / TECHNICAL BYPASS
  // --------------------------------------------------------------------------
  if (bypass) return true;

  // --------------------------------------------------------------------------
  // SOURCE-LEVEL PERMISSIONS (7.9)
  // action: "source:<key>"
  // ctx.source — запись источника из БД
  // --------------------------------------------------------------------------
  if (typeof action === "string" && action.startsWith("source:")) {
    const source = ctx?.source;

    // Без данных об источнике — запрещаем (безопасный дефолт)
    if (!source) return false;

    // Источник выключен
    if (source.enabled === false) return false;

    const roles = Array.isArray(source.roles) ? source.roles : [];
    const plans = Array.isArray(source.plans) ? source.plans : [];

    // Строгий дефолт: если не задано — запрещено
    if (!roles.length || !plans.length) return false;

    return roles.includes(role) && plans.includes(plan);
  }

  // --------------------------------------------------------------------------
  // COMMAND-LEVEL PERMISSIONS (7.8)
  // --------------------------------------------------------------------------

  // Разрешённые команды для guest
  const guestAllow = new Set([
    // профиль
    "cmd.profile",
    "cmd.me",
    "cmd.whoami",

    // режим ответа
    "cmd.mode",

    // задачи
    "cmd.tasks.list",
    "cmd.task.run",
    "cmd.task.create",

    // цены
    "cmd.price",
    "cmd.prices",

    // источники
    "cmd.sources.list",
    "cmd.source.fetch",
    "cmd.source.diagnose",
  ]);

  if (role === "guest") {
    return guestAllow.has(action);
  }

  // --------------------------------------------------------------------------
  // DEFAULT (citizen / vip / future roles)
  // --------------------------------------------------------------------------
  // Пока что: всё разрешено (будет ужесточаться позже)
  return true;
}
