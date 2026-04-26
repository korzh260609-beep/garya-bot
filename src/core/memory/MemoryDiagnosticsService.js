// src/core/memory/MemoryDiagnosticsService.js
// STAGE 7.8.9 — DIAGNOSTICS FOR ARCHIVE / DIGEST / RECALL / POLICY (SKELETON)
//
// Goal:
// - provide read-only diagnostics for memory skeleton/policy services
// - verify that dangerous flags remain disabled
// - detect missing services and unsafe policy outputs
// - keep diagnostics separated from runtime writes and AI logic
//
// IMPORTANT SAFETY RULES:
// - NO DB schema changes.
// - NO DB reads/writes here.
// - NO AI logic here.
// - NO automatic prompt injection.
// - This module is deterministic diagnostics only.

function _safeObj(o) {
  try {
    if (!o) return {};
    if (typeof o === "object") return o;
    return { value: String(o) };
  } catch (_) {
    return {};
  }
}

function _hasUnsafeTrue(obj, keys = []) {
  const o = _safeObj(obj);
  return keys.filter((key) => o[key] === true);
}

export const MEMORY_DIAGNOSTICS_SERVICE_VERSION =
  "memory-diagnostics-service-7.8.9-002";

export class MemoryDiagnosticsService {
  constructor({ logger = console, getEnabled = () => false, contractVersion = 1 } = {}) {
    this.logger = logger || console;
    this.getEnabled =
      typeof getEnabled === "function" ? getEnabled : () => false;
    this.contractVersion = contractVersion;
  }

  _baseResult(extra = {}) {
    return {
      ok: true,
      enabled: !!this.getEnabled(),
      service: "MemoryDiagnosticsService",
      version: MEMORY_DIAGNOSTICS_SERVICE_VERSION,
      contractVersion: this.contractVersion,
      dbWrites: false,
      dbReads: false,
      aiLogic: false,
      promptInjection: false,
      ...extra,
    };
  }

  runSafetyDiagnostics({
    archiveStatus = null,
    topicDigestStatus = null,
    topicRecallStatus = null,
    rawPromptGuardStatus = null,
    confirmedGuardStatus = null,
    layerPolicy = null,
    periodicReviewPolicy = null,
    topicGroupingPolicy = null,
    digestGenerationPolicy = null,
    privacyAttributionPolicy = null,
  } = {}) {
    const errors = [];
    const warnings = [];
    const checks = [];

    const archive = _safeObj(archiveStatus);
    const digest = _safeObj(topicDigestStatus);
    const recall = _safeObj(topicRecallStatus);
    const rawPromptGuard = _safeObj(rawPromptGuardStatus);
    const confirmedGuard = _safeObj(confirmedGuardStatus);
    const layer = _safeObj(layerPolicy);
    const periodic = _safeObj(periodicReviewPolicy);
    const grouping = _safeObj(topicGroupingPolicy);
    const digestGen = _safeObj(digestGenerationPolicy);
    const privacy = _safeObj(privacyAttributionPolicy);

    if (!archive.service) errors.push("missing_archive_status");
    if (!digest.service) errors.push("missing_topic_digest_status");
    if (!recall.service) errors.push("missing_topic_recall_status");
    if (!rawPromptGuard.service) errors.push("missing_raw_prompt_guard_status");
    if (!confirmedGuard.service) errors.push("missing_confirmed_guard_status");
    if (!layer.version) errors.push("missing_layer_policy");
    if (!periodic.version) errors.push("missing_periodic_review_policy");
    if (!grouping.version) errors.push("missing_topic_grouping_policy");
    if (!digestGen.version) errors.push("missing_digest_generation_policy");
    if (!privacy.version) errors.push("missing_privacy_attribution_policy");

    const archiveUnsafe = _hasUnsafeTrue(archive, [
      "storageActive",
      "promptFacing",
      "rawPromptInjectionAllowed",
      "confirmedMemory",
      "digestMemory",
    ]);
    if (archiveUnsafe.length) {
      errors.push(`archive_unsafe_flags:${archiveUnsafe.join(",")}`);
    }

    const digestUnsafe = _hasUnsafeTrue(digest, [
      "storageActive",
      "aiGenerationActive",
      "promptFacing",
      "rawPromptInjectionAllowed",
      "confirmedMemory",
      "archiveMemory",
    ]);
    if (digestUnsafe.length) {
      errors.push(`topic_digest_unsafe_flags:${digestUnsafe.join(",")}`);
    }

    const recallUnsafe = _hasUnsafeTrue(recall, [
      "promptFacing",
      "rawArchivePromptAllowed",
      "crossUserRecallAllowed",
      "crossGroupRecallAllowed",
    ]);
    if (recallUnsafe.length) {
      errors.push(`topic_recall_unsafe_flags:${recallUnsafe.join(",")}`);
    }

    const rawPromptGuardUnsafe = _hasUnsafeTrue(rawPromptGuard, [
      "rawDialoguePromptAllowedByDefault",
      "promptConstruction",
      "dbWrites",
      "dbReads",
      "aiLogic",
    ]);
    if (rawPromptGuardUnsafe.length) {
      errors.push(`raw_prompt_guard_unsafe_flags:${rawPromptGuardUnsafe.join(",")}`);
    }

    const confirmedGuardUnsafe = _hasUnsafeTrue(confirmedGuard, [
      "dbReads",
      "dbWrites",
      "aiLogic",
      "automaticWrites",
    ]);
    if (confirmedGuardUnsafe.length) {
      errors.push(`confirmed_guard_unsafe_flags:${confirmedGuardUnsafe.join(",")}`);
    }

    const periodicDefaults = _safeObj(periodic.defaults);
    const periodicUnsafe = _hasUnsafeTrue(periodicDefaults, [
      "enabledByDefault",
      "allowRawPromptInjection",
      "allowAutomaticConfirmedMemoryWrites",
      "allowAutomaticDigestWrites",
    ]);
    if (periodicUnsafe.length) {
      errors.push(`periodic_review_unsafe_defaults:${periodicUnsafe.join(",")}`);
    }

    const groupingDefaults = _safeObj(grouping.defaults);
    const groupingUnsafe = _hasUnsafeTrue(groupingDefaults, [
      "allowCrossUserGrouping",
      "allowCrossGroupGrouping",
      "allowRawPromptInjection",
      "aiClusteringActive",
      "vectorSearchActive",
    ]);
    if (groupingUnsafe.length) {
      errors.push(`topic_grouping_unsafe_defaults:${groupingUnsafe.join(",")}`);
    }

    const digestGenDefaults = _safeObj(digestGen.defaults);
    const digestGenUnsafe = _hasUnsafeTrue(digestGenDefaults, [
      "enabledByDefault",
      "aiGenerationActive",
      "automaticDigestWritesAllowed",
      "automaticConfirmedMemoryWritesAllowed",
      "rawPromptInjectionAllowed",
    ]);
    if (digestGenUnsafe.length) {
      errors.push(`digest_generation_unsafe_defaults:${digestGenUnsafe.join(",")}`);
    }

    const privacyDefaults = _safeObj(privacy.defaults);
    const privacyUnsafe = _hasUnsafeTrue(privacyDefaults, [
      "allowCrossUserRecall",
      "allowCrossGroupRecall",
      "allowPrivateMemoryInGroup",
      "allowGroupMemoryInPrivate",
      "rawPromptInjectionAllowed",
    ]);
    if (privacyUnsafe.length) {
      errors.push(`privacy_unsafe_defaults:${privacyUnsafe.join(",")}`);
    }

    checks.push({ name: "archive_status_present", ok: !!archive.service });
    checks.push({ name: "topic_digest_status_present", ok: !!digest.service });
    checks.push({ name: "topic_recall_status_present", ok: !!recall.service });
    checks.push({ name: "raw_prompt_guard_status_present", ok: !!rawPromptGuard.service });
    checks.push({ name: "confirmed_guard_status_present", ok: !!confirmedGuard.service });
    checks.push({ name: "layer_policy_present", ok: !!layer.version });
    checks.push({ name: "periodic_review_policy_present", ok: !!periodic.version });
    checks.push({ name: "topic_grouping_policy_present", ok: !!grouping.version });
    checks.push({ name: "digest_generation_policy_present", ok: !!digestGen.version });
    checks.push({ name: "privacy_attribution_policy_present", ok: !!privacy.version });
    checks.push({ name: "unsafe_flags_absent", ok: errors.length === 0 });

    if (errors.length === 0 && warnings.length === 0) {
      warnings.push("diagnostics_skeleton_only_no_runtime_archive_or_digest_validation");
    }

    return this._baseResult({
      ok: errors.length === 0,
      errors,
      warnings,
      checks,
      summary: {
        validation: errors.length === 0 ? "OK" : "FAILED",
        errors: errors.length,
        warnings: warnings.length,
        checks: checks.length,
        advisoryOnly: true,
        sourceOfTruth: "runtime_status_and_policy_outputs",
      },
    });
  }

  status() {
    return this._baseResult({
      methods: ["runSafetyDiagnostics", "status"],
      reason: "memory_diagnostics_service_active_read_only",
    });
  }
}

export default MemoryDiagnosticsService;
