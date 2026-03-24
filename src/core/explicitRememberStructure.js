// src/core/explicitRememberStructure.js
// STAGE 11.x — structured memory mapping
//
// Goal:
// - add safe parallel structure for explicit remember classification
// - DO NOT break existing rememberKey flow
// - map legacy/current rememberKey -> domain + slot
// - keep deterministic only
// - no AI
//
// This file is intentionally additive.
// Current runtime can continue using rememberKey / rememberType as before.
// New structured layer is for gradual migration toward:
//   domain -> slot -> value

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function cleanValue(value) {
  return safeStr(value).replace(/\s+/g, " ").trim();
}

function buildStructuredResult({
  key = "user_explicit_memory",
  value = "",
  domain = "user_memory",
  slot = "generic",
  source = "explicit_remember_structure.default",
} = {}) {
  const normalizedValue = cleanValue(value);

  return {
    key,
    value: normalizedValue,
    domain,
    slot,
    canonicalKey: `${domain}.${slot}`,
    source,
  };
}

function mapIdentityKey(key, value) {
  if (key === "name") {
    return buildStructuredResult({
      key,
      value,
      domain: "identity",
      slot: "name",
      source: "explicit_remember_structure.identity.name",
    });
  }

  return null;
}

function mapPreferenceKey(key, value) {
  if (key === "communication_style") {
    return buildStructuredResult({
      key,
      value,
      domain: "user_preference",
      slot: "communication_style",
      source: "explicit_remember_structure.user_preference.communication_style",
    });
  }

  return null;
}

function mapTaskKey(key, value) {
  if (key === "task_schedule") {
    return buildStructuredResult({
      key,
      value,
      domain: "task",
      slot: "schedule",
      source: "explicit_remember_structure.task.schedule",
    });
  }

  return null;
}

function mapVehicleProfileKey(key, value) {
  if (key === "car") {
    return buildStructuredResult({
      key,
      value,
      domain: "vehicle_profile",
      slot: "vehicle",
      source: "explicit_remember_structure.vehicle_profile.vehicle",
    });
  }

  if (key === "car_engine") {
    return buildStructuredResult({
      key,
      value,
      domain: "vehicle_profile",
      slot: "engine",
      source: "explicit_remember_structure.vehicle_profile.engine",
    });
  }

  if (key === "car_trim") {
    return buildStructuredResult({
      key,
      value,
      domain: "vehicle_profile",
      slot: "trim",
      source: "explicit_remember_structure.vehicle_profile.trim",
    });
  }

  return null;
}

function mapVehicleMaintenanceKey(key, value) {
  switch (key) {
    case "maintenance_oil_last_change":
      return buildStructuredResult({
        key,
        value,
        domain: "vehicle_maintenance",
        slot: "oil_last_change",
        source: "explicit_remember_structure.vehicle_maintenance.oil_last_change",
      });

    case "maintenance_oil_interval":
      return buildStructuredResult({
        key,
        value,
        domain: "vehicle_maintenance",
        slot: "oil_interval",
        source: "explicit_remember_structure.vehicle_maintenance.oil_interval",
      });

    case "maintenance_fuel_filter_last_change":
      return buildStructuredResult({
        key,
        value,
        domain: "vehicle_maintenance",
        slot: "fuel_filter_last_change",
        source:
          "explicit_remember_structure.vehicle_maintenance.fuel_filter_last_change",
      });

    case "maintenance_fuel_filter_interval":
      return buildStructuredResult({
        key,
        value,
        domain: "vehicle_maintenance",
        slot: "fuel_filter_interval",
        source:
          "explicit_remember_structure.vehicle_maintenance.fuel_filter_interval",
      });

    case "maintenance_haldex_last_change":
      return buildStructuredResult({
        key,
        value,
        domain: "vehicle_maintenance",
        slot: "haldex_last_change",
        source:
          "explicit_remember_structure.vehicle_maintenance.haldex_last_change",
      });

    case "maintenance_haldex_interval":
      return buildStructuredResult({
        key,
        value,
        domain: "vehicle_maintenance",
        slot: "haldex_interval",
        source:
          "explicit_remember_structure.vehicle_maintenance.haldex_interval",
      });

    case "car_service_fact":
      return buildStructuredResult({
        key,
        value,
        domain: "vehicle_maintenance",
        slot: "service_fact",
        source: "explicit_remember_structure.vehicle_maintenance.service_fact",
      });

    default:
      return null;
  }
}

export function deriveExplicitRememberStructure({
  key = "user_explicit_memory",
  value = "",
} = {}) {
  const safeKey = safeStr(key).trim() || "user_explicit_memory";
  const safeValue = cleanValue(value);

  const mappers = [
    mapIdentityKey,
    mapPreferenceKey,
    mapTaskKey,
    mapVehicleProfileKey,
    mapVehicleMaintenanceKey,
  ];

  for (const mapper of mappers) {
    const result = mapper(safeKey, safeValue);
    if (result) return result;
  }

  return buildStructuredResult({
    key: safeKey,
    value: safeValue,
    domain: "user_memory",
    slot: "generic",
    source: "explicit_remember_structure.fallback",
  });
}

export function deriveExplicitRememberCanonicalKey(input = {}) {
  return deriveExplicitRememberStructure(input).canonicalKey;
}

export function deriveExplicitRememberDomain(input = {}) {
  return deriveExplicitRememberStructure(input).domain;
}

export function deriveExplicitRememberSlot(input = {}) {
  return deriveExplicitRememberStructure(input).slot;
}

export default deriveExplicitRememberStructure;