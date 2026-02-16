// ============================================================================
// === permissions.js — Permissions-layer V1.3 ================================
// Единая точка контроля доступа (commands + sources)
// ============================================================================

export function can(user, action, ctx = {}) {
  const role = (user?.role || "guest").toLowerCase();
  const plan = (user?.plan || "free").toLowerCase();

  // --------------------------------------------------------------------------
  // IMPORTANT (Stage 4.C)
  // --------------------------------------------------------------------------
  // ❌ bypassPermissions больше НЕ используется как критерий доступа.
  // Монарх/админ-доступ определяется ТОЛЬКО ролью role === "monarch",
  // которую обязан выставлять identity/role-layer (isMonarch()/monarchNow).
  // Это убирает риск случайного выдачи админки гостям через bypass.
  // --------------------------------------------------------------------------

  // --------------------------------------------------------------------------
  // COMMAND-LEVEL HARD BLOCK FOR ADMIN ACTIONS
  // --------------------------------------------------------------------------
  // Любые cmd.admin.* запрещены всем, кроме реального монарха.
  if (typeof action === "string" && action.startsWith("cmd.admin.")) {
    return role === "monarch";
  }

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

  // Разрешённые действия для guest (allowlist)
  const guestAllow = new Set([
    // профиль
    "cmd.profile",
    "cmd.me",
    "cmd.whoami",

    // режим ответа
    "cmd.mode",

    // linking identity (stage 4.4)
    "cmd.identity.link_start",
    "cmd.identity.link_confirm",
    "cmd.identity.link_status",

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
    "cmd.source.test",
  ]);

  if (role === "guest") {
    return guestAllow.has(action);
  }

  // --------------------------------------------------------------------------
  // DEFAULT (citizen / vip / future roles)
  // --------------------------------------------------------------------------
  // Пока что: всё разрешено, НО admin actions уже жёстко запрещены выше.
  return true;
}
