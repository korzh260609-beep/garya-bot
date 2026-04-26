// src/core/commandPolicy/CommandPolicyService.js
// ============================================================================
// STAGE 7A — Command Policy Service skeleton
// Purpose:
// - prepare transport-agnostic command policy boundary
// - keep current Telegram PRIVATE_ONLY_COMMANDS behavior unchanged
// - define one future place for command access rules
// - do NOT execute handlers here
// - do NOT decide business logic here
// ============================================================================

export const COMMAND_POLICY_VERSION = 1;

export const COMMAND_POLICY_SCOPES = Object.freeze({
  GENERAL: "general",
  PROJECT_MEMORY: "project_memory",
  PROJECT_REPO: "project_repo",
  MEMORY_DIAGNOSTICS: "memory_diagnostics",
  SOURCES: "sources",
  SYSTEM: "system",
  DEV: "dev",
});

export const DEFAULT_COMMAND_POLICY = Object.freeze({
  command: null,
  monarchOnly: false,
  privateOnly: false,
  safePrivateContext: false,
  allowedTransports: [],
  requiresTrustedPath: false,
  scope: COMMAND_POLICY_SCOPES.GENERAL,
});

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeCommand(command) {
  const text = safeText(command);

  if (!text || !text.startsWith("/")) {
    return null;
  }

  return text.split("@")[0];
}

function normalizeTransport(transport) {
  return safeText(transport) || "telegram";
}

function normalizeAllowedTransports(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeTransport(item))
    .filter(Boolean);
}

function isAllowedTransport({ transport, allowedTransports } = {}) {
  const list = normalizeAllowedTransports(allowedTransports);

  if (!list.length) {
    return true;
  }

  return list.includes(normalizeTransport(transport));
}

function buildPolicy(input = {}) {
  const command = normalizeCommand(input.command);

  return {
    command,
    monarchOnly: input.monarchOnly === true,
    privateOnly: input.privateOnly === true,
    safePrivateContext: input.safePrivateContext === true,
    allowedTransports: normalizeAllowedTransports(input.allowedTransports),
    requiresTrustedPath: input.requiresTrustedPath === true,
    scope: safeText(input.scope) || COMMAND_POLICY_SCOPES.GENERAL,
  };
}

function buildDefaultDecision({ command, transport, reason = "allowed_by_default" } = {}) {
  return {
    ok: true,
    allowed: true,
    blocked: false,
    reason,
    command: normalizeCommand(command),
    transport: normalizeTransport(transport),
    policy: {
      ...DEFAULT_COMMAND_POLICY,
      command: normalizeCommand(command),
    },
    version: COMMAND_POLICY_VERSION,
  };
}

export class CommandPolicyService {
  constructor({ policies = [] } = {}) {
    this.policies = new Map();

    for (const policy of policies) {
      this.registerPolicy(policy);
    }
  }

  registerPolicy(input = {}) {
    const policy = buildPolicy(input);

    if (!policy.command) {
      return null;
    }

    this.policies.set(policy.command, policy);
    return policy;
  }

  getPolicy(command) {
    const cmd0 = normalizeCommand(command);

    if (!cmd0) {
      return null;
    }

    return this.policies.get(cmd0) || null;
  }

  listPolicies() {
    return Array.from(this.policies.values());
  }

  evaluate({
    command,
    transport = null,
    isPrivate = false,
    isMonarch = false,
    bypass = false,
  } = {}) {
    const cmd0 = normalizeCommand(command);
    const transportName = normalizeTransport(transport);

    if (!cmd0) {
      return {
        ok: false,
        allowed: false,
        blocked: true,
        reason: "invalid_command",
        command: null,
        transport: transportName,
        policy: null,
        version: COMMAND_POLICY_VERSION,
      };
    }

    const policy = this.getPolicy(cmd0);

    if (!policy) {
      return buildDefaultDecision({
        command: cmd0,
        transport: transportName,
      });
    }

    if (!isAllowedTransport({ transport: transportName, allowedTransports: policy.allowedTransports })) {
      return {
        ok: true,
        allowed: false,
        blocked: true,
        reason: "transport_not_allowed",
        command: cmd0,
        transport: transportName,
        policy,
        version: COMMAND_POLICY_VERSION,
      };
    }

    if (policy.privateOnly && !isPrivate) {
      return {
        ok: true,
        allowed: false,
        blocked: true,
        reason: "private_only",
        command: cmd0,
        transport: transportName,
        policy,
        version: COMMAND_POLICY_VERSION,
      };
    }

    if (policy.monarchOnly && !isMonarch && !bypass) {
      return {
        ok: true,
        allowed: false,
        blocked: true,
        reason: "monarch_only",
        command: cmd0,
        transport: transportName,
        policy,
        version: COMMAND_POLICY_VERSION,
      };
    }

    if (policy.requiresTrustedPath && !bypass) {
      return {
        ok: true,
        allowed: false,
        blocked: true,
        reason: "trusted_path_required",
        command: cmd0,
        transport: transportName,
        policy,
        version: COMMAND_POLICY_VERSION,
      };
    }

    return {
      ok: true,
      allowed: true,
      blocked: false,
      reason: "allowed_by_policy",
      command: cmd0,
      transport: transportName,
      policy,
      version: COMMAND_POLICY_VERSION,
    };
  }

  status() {
    return {
      ok: true,
      version: COMMAND_POLICY_VERSION,
      policyCount: this.policies.size,
      scopes: Object.values(COMMAND_POLICY_SCOPES),
    };
  }
}

export default CommandPolicyService;
