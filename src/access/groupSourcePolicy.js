// src/access/groupSourcePolicy.js
// STAGE 11.17 — GROUP SOURCE POLICIES (SKELETON ONLY)
//
// IMPORTANT:
// - skeleton only
// - NO runtime wiring yet
// - NO command wiring here
// - NO can() integration yet
// - NO recall integration yet
// - NO cross-group retrieval here
// - NO author identity exposure
//
// Purpose:
// define one explicit privacy/policy contract for future group-source usage,
// so Stage 8A.8 / 8A.9 can depend on a stable policy boundary later.
//
// Workflow dependency:
// - Stage 7B.10 = text redaction contract
// - Stage 11.17 = access/privacy contract
// - only after BOTH exist may future cross-group recall be considered
//
// Hard rule:
// this file must remain non-authoritative for runtime until a separate approved
// wiring step is performed and repo state is re-verified.

const ROLE_GUEST = "guest";
const ROLE_CITIZEN = "citizen";
const ROLE_VIP = "vip";
const ROLE_MONARCH = "monarch";

const VISIBILITY_NONE = "none";
const VISIBILITY_ALIAS_ONLY = "alias_only";
const VISIBILITY_ALIAS_AND_SUMMARY = "alias_and_summary";

function toSafeString(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function normalizeRole(role) {
  const value = toSafeString(role).trim().toLowerCase();

  if (!value) return ROLE_GUEST;
  if (value === ROLE_MONARCH) return ROLE_MONARCH;
  if (value === ROLE_VIP) return ROLE_VIP;
  if (value === ROLE_CITIZEN) return ROLE_CITIZEN;
  return ROLE_GUEST;
}

function normalizePrivacyLevel(value) {
  const v = toSafeString(value).trim().toLowerCase();

  // Skeleton-safe defaults.
  // Unknown values must collapse to the strictest safe mode.
  if (v === "public") return "public";
  if (v === "citizens") return "citizens";
  if (v === "vip") return "vip";
  if (v === "monarch") return "monarch";
  if (v === "private") return "private";

  return "private";
}

function getRoleRank(role) {
  switch (normalizeRole(role)) {
    case ROLE_MONARCH:
      return 4;
    case ROLE_VIP:
      return 3;
    case ROLE_CITIZEN:
      return 2;
    case ROLE_GUEST:
    default:
      return 1;
  }
}

function requiredRankForPrivacyLevel(privacyLevel) {
  switch (normalizePrivacyLevel(privacyLevel)) {
    case "public":
      return 1;
    case "citizens":
      return 2;
    case "vip":
      return 3;
    case "monarch":
      return 4;
    case "private":
    default:
      return 999;
  }
}

function buildDenied(reason, extra = {}) {
  return {
    allowed: false,
    visibility: VISIBILITY_NONE,
    allowQuotes: false,
    allowRawSnippets: false,
    authorIdentityAllowed: false,
    denyReason: reason,
    ...extra,
  };
}

export function evaluateGroupSourcePolicy(input = {}) {
  const role = normalizeRole(input.role);
  const privacyLevel = normalizePrivacyLevel(input.privacyLevel);

  const sourceEnabled = input.sourceEnabled === true;
  const alias = toSafeString(input.alias).trim();

  // Stage 11.17.2 hard rule:
  // ban author identity output
  const authorIdentityAllowed = false;

  // Stage 11.17.3 hard rule:
  // ban quotes
  // Even if DB flag exists, policy contract currently forces false for safety.
  const allowQuotes = false;

  // Safe default:
  // raw snippets remain blocked at this stage even if DB flag exists.
  const allowRawSnippets = false;

  const meta = {
    contractVersion: 1,
    skeletonOnly: true,
    runtimeActive: false,

    role,
    roleRank: getRoleRank(role),
    privacyLevel,
    requiredRank: requiredRankForPrivacyLevel(privacyLevel),

    sourceEnabled,
    aliasPresent: Boolean(alias),

    // Explicit guardrails for future integration.
    stageBoundary: "11.17",
    intendedConsumers: ["future_recall_policy_gate", "future_group_source_cards"],
    runtimeConsumerApproved: false,
  };

  if (!sourceEnabled) {
    return {
      ...buildDenied("source_disabled"),
      meta,
    };
  }

  if (!alias) {
    return {
      ...buildDenied("alias_required"),
      meta,
    };
  }

  const roleRank = getRoleRank(role);
  const requiredRank = requiredRankForPrivacyLevel(privacyLevel);

  if (requiredRank >= 999) {
    return {
      ...buildDenied("privacy_private_blocked"),
      meta,
    };
  }

  if (roleRank < requiredRank) {
    return {
      ...buildDenied("role_insufficient_for_privacy_level"),
      meta,
    };
  }

  // Safe visibility policy at this stage:
  // - guest/public => alias only
  // - citizen/vip/monarch => alias + summary
  // - never author identity
  // - never quotes
  // - never raw snippets
  const visibility =
    roleRank >= 2 ? VISIBILITY_ALIAS_AND_SUMMARY : VISIBILITY_ALIAS_ONLY;

  return {
    allowed: true,
    visibility,
    allowQuotes,
    allowRawSnippets,
    authorIdentityAllowed,
    denyReason: null,
    meta,
  };
}

export function buildGroupSourcePolicyPreview(input = {}) {
  const result = evaluateGroupSourcePolicy(input);

  return {
    previewOnly: true,
    policy: result,
  };
}

export default evaluateGroupSourcePolicy;