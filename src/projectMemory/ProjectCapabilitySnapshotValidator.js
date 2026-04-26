// src/projectMemory/ProjectCapabilitySnapshotValidator.js
// ============================================================================
// PROJECT CAPABILITY SNAPSHOT VALIDATOR
// Stage: 7A.13 Project Capability Snapshot
//
// Purpose:
// - validate generated capability/status snapshot shape
// - keep validation separate from builder logic
// - return structured validation results without throwing by default
//
// Important:
// - This file has no DB writes.
// - This file has no Telegram command wiring.
// - This file has no runtime side effects.
// ============================================================================

import {
  PROJECT_CAPABILITY_ADVISORY_ONLY,
  PROJECT_CAPABILITY_EVIDENCE_KEYS,
  PROJECT_CAPABILITY_ITEM_KEYS,
  PROJECT_CAPABILITY_SNAPSHOT_REQUIRED_TOP_LEVEL_KEYS,
  PROJECT_CAPABILITY_SNAPSHOT_SCHEMA_VERSION,
  PROJECT_CAPABILITY_SNAPSHOT_TYPE,
  PROJECT_CAPABILITY_SOURCE_OF_TRUTH,
  PROJECT_CAPABILITY_STATUS,
} from "./ProjectCapabilitySnapshotShape.js";

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function pushMissingKeys(errors, object, keys, path) {
  for (const key of keys) {
    if (!hasOwn(object, key)) {
      errors.push(`${path}.${key} is missing`);
    }
  }
}

function validateStringArray(errors, value, path) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }

  value.forEach((item, index) => {
    if (typeof item !== "string") {
      errors.push(`${path}[${index}] must be a string`);
    }
  });
}

function validateProject(errors, project) {
  if (!isPlainObject(project)) {
    errors.push("snapshot.project must be an object");
    return;
  }

  for (const key of ["key", "name", "stageKey"]) {
    if (typeof project[key] !== "string") {
      errors.push(`snapshot.project.${key} must be a string`);
    }
  }
}

function validateEvidence(errors, evidence) {
  if (!isPlainObject(evidence)) {
    errors.push("snapshot.evidence must be an object");
    return;
  }

  pushMissingKeys(errors, evidence, PROJECT_CAPABILITY_EVIDENCE_KEYS, "snapshot.evidence");

  if (typeof evidence.repoRef !== "string") {
    errors.push("snapshot.evidence.repoRef must be a string");
  }

  validateStringArray(errors, evidence.verifiedFiles, "snapshot.evidence.verifiedFiles");
  validateStringArray(
    errors,
    evidence.verifiedCommands,
    "snapshot.evidence.verifiedCommands"
  );
  validateStringArray(
    errors,
    evidence.verifiedCommits,
    "snapshot.evidence.verifiedCommits"
  );

  for (const key of ["facts", "runtime", "tests"]) {
    if (!isPlainObject(evidence[key])) {
      errors.push(`snapshot.evidence.${key} must be an object`);
    }
  }
}

function validateCapability(errors, capability, index) {
  const path = `snapshot.capabilities[${index}]`;

  if (!isPlainObject(capability)) {
    errors.push(`${path} must be an object`);
    return;
  }

  pushMissingKeys(errors, capability, PROJECT_CAPABILITY_ITEM_KEYS, path);

  for (const key of ["key", "title", "status", "userBenefit"]) {
    if (typeof capability[key] !== "string") {
      errors.push(`${path}.${key} must be a string`);
    }
  }

  if (!Object.values(PROJECT_CAPABILITY_STATUS).includes(capability.status)) {
    errors.push(`${path}.status is not a known Project Capability status`);
  }

  validateStringArray(errors, capability.evidenceRefs, `${path}.evidenceRefs`);
  validateStringArray(errors, capability.limitations, `${path}.limitations`);
}

export function validateProjectCapabilitySnapshot(snapshot) {
  const errors = [];

  if (!isPlainObject(snapshot)) {
    return {
      ok: false,
      errors: ["snapshot must be an object"],
    };
  }

  pushMissingKeys(
    errors,
    snapshot,
    PROJECT_CAPABILITY_SNAPSHOT_REQUIRED_TOP_LEVEL_KEYS,
    "snapshot"
  );

  if (snapshot.schemaVersion !== PROJECT_CAPABILITY_SNAPSHOT_SCHEMA_VERSION) {
    errors.push("snapshot.schemaVersion is invalid");
  }

  if (typeof snapshot.builderVersion !== "string" || !snapshot.builderVersion) {
    errors.push("snapshot.builderVersion must be a non-empty string");
  }

  if (snapshot.snapshotType !== PROJECT_CAPABILITY_SNAPSHOT_TYPE) {
    errors.push("snapshot.snapshotType is invalid");
  }

  if (typeof snapshot.generatedAt !== "string" || !snapshot.generatedAt) {
    errors.push("snapshot.generatedAt must be a non-empty string");
  }

  if (snapshot.sourceOfTruth !== PROJECT_CAPABILITY_SOURCE_OF_TRUTH) {
    errors.push("snapshot.sourceOfTruth is invalid");
  }

  if (snapshot.advisoryOnly !== PROJECT_CAPABILITY_ADVISORY_ONLY) {
    errors.push("snapshot.advisoryOnly is invalid");
  }

  if (typeof snapshot.notice !== "string" || !snapshot.notice) {
    errors.push("snapshot.notice must be a non-empty string");
  }

  validateProject(errors, snapshot.project);
  validateEvidence(errors, snapshot.evidence);

  if (!Array.isArray(snapshot.capabilities)) {
    errors.push("snapshot.capabilities must be an array");
  } else {
    snapshot.capabilities.forEach((capability, index) => {
      validateCapability(errors, capability, index);
    });
  }

  validateStringArray(errors, snapshot.limitations, "snapshot.limitations");

  if (typeof snapshot.nextSafeStep !== "string") {
    errors.push("snapshot.nextSafeStep must be a string");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export default {
  validateProjectCapabilitySnapshot,
};
