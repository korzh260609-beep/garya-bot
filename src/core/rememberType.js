// src/core/rememberType.js
// STAGE 7.4+ — rememberType derivation from rememberKey
//
// Goal:
// - keep one authoritative mapping rememberKey -> rememberType
// - avoid duplicated logic in MemoryService / CleanupService
// - no DB/schema changes
// - deterministic only

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

export function deriveRememberTypeFromKey(key) {
  const k = safeStr(key).trim().toLowerCase();

  if (!k) return "general_fact";

  // ==========================================================
  // USER PROFILE
  // ==========================================================
  if (k === "name") {
    return "user_profile";
  }

  // ==========================================================
  // USER PREFERENCES / COMMUNICATION
  // ==========================================================
  if (k === "communication_style") {
    return "user_profile";
  }

  // ==========================================================
  // TASK / SCHEDULE
  // ==========================================================
  if (k === "task_schedule") {
    return "task_intent";
  }

  // ==========================================================
  // VEHICLE PROFILE
  // ==========================================================
  if (k === "car" || k === "car_engine" || k === "car_trim") {
    return "vehicle_profile";
  }

  // ==========================================================
  // MAINTENANCE INTERVALS
  // ==========================================================
  if (
    k === "maintenance_oil_interval" ||
    k === "maintenance_fuel_filter_interval" ||
    k === "maintenance_haldex_interval"
  ) {
    return "maintenance_interval";
  }

  // ==========================================================
  // MAINTENANCE FACTS / LAST CHANGE
  // ==========================================================
  if (
    k === "maintenance_oil_last_change" ||
    k === "maintenance_fuel_filter_last_change" ||
    k === "maintenance_haldex_last_change" ||
    k === "car_service_fact"
  ) {
    return "maintenance_fact";
  }

  // ==========================================================
  // FALLBACK
  // ==========================================================
  if (k === "user_explicit_memory") {
    return "general_fact";
  }

  return "general_fact";
}

export default deriveRememberTypeFromKey;