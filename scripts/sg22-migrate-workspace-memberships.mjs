#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MIGRATION_VERSION = 1;
const stateDir = process.env.OPENCLAW_STATE_DIR || "/data/.openclaw";
const sgDir = path.join(stateDir, "sg");
const storePath = path.join(sgDir, "workspace-memberships.json");
const archivePath = path.join(sgDir, "archive", `workspace-memberships-v${MIGRATION_VERSION}.json`);
const pluginEnabled = process.env.SG_WORKSPACE_PLUGIN_ENABLED !== "false";

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const nonEmpty = (value) => typeof value === "string" && Boolean(value.trim());
const timestamp = (value) => nonEmpty(value) && !Number.isNaN(Date.parse(value));
const checksum = (value) => createHash("sha256").update(value).digest("hex");
const normalizedJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

async function readOptional(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

async function writeAtomically(filePath, text) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.migrate-${process.pid}.tmp`;
  await writeFile(temporaryPath, text, { mode: 0o600 });
  await rename(temporaryPath, filePath);
}

function validMembership(value) {
  return (
    isObject(value) &&
    nonEmpty(value.membershipId) &&
    nonEmpty(value.workspaceId) &&
    nonEmpty(value.globalId) &&
    ["admin", "member"].includes(value.role) &&
    ["active", "revoked"].includes(value.status) &&
    nonEmpty(value.operationId) &&
    nonEmpty(value.grantedByGlobalId) &&
    (value.revokedByGlobalId === undefined || nonEmpty(value.revokedByGlobalId)) &&
    timestamp(value.createdAt) &&
    timestamp(value.updatedAt)
  );
}

function validAuditEvent(value) {
  return (
    isObject(value) &&
    nonEmpty(value.eventId) &&
    nonEmpty(value.operationId) &&
    ["grant", "revoke"].includes(value.action) &&
    nonEmpty(value.workspaceId) &&
    nonEmpty(value.targetGlobalId) &&
    nonEmpty(value.actorGlobalId) &&
    ["admin", "member"].includes(value.role) &&
    timestamp(value.createdAt)
  );
}

function validateStore(value) {
  if (
    !isObject(value) ||
    value.version !== 1 ||
    !Array.isArray(value.memberships) ||
    !value.memberships.every(validMembership) ||
    !Array.isArray(value.audit) ||
    !value.audit.every(validAuditEvent)
  ) {
    return false;
  }
  const membershipKeys = value.memberships.map((item) => `${item.workspaceId}\0${item.globalId}`);
  const membershipIds = value.memberships.map((item) => item.membershipId);
  const eventIds = value.audit.map((item) => item.eventId);
  const auditOperationIds = value.audit.map((item) => item.operationId);
  const auditOperations = new Set(auditOperationIds);
  return (
    new Set(membershipKeys).size === membershipKeys.length &&
    new Set(membershipIds).size === membershipIds.length &&
    new Set(eventIds).size === eventIds.length &&
    new Set(auditOperationIds).size === auditOperationIds.length &&
    value.memberships.every((item) => auditOperations.has(item.operationId))
  );
}

function legacyRecordsChecksum(store) {
  return checksum(JSON.stringify({ memberships: store.memberships, audit: store.audit }));
}

function validateArchive(value) {
  return (
    isObject(value) &&
    value.migrationVersion === MIGRATION_VERSION &&
    value.sourceStoreVersion === 1 &&
    timestamp(value.archivedAt) &&
    /^[a-f0-9]{64}$/u.test(value.sourceChecksum) &&
    /^[a-f0-9]{64}$/u.test(value.legacyRecordsChecksum) &&
    validateStore({ version: 1, memberships: value.memberships, audit: value.audit }) &&
    value.legacyRecordsChecksum ===
      legacyRecordsChecksum({ memberships: value.memberships, audit: value.audit })
  );
}

async function migrate() {
  if (!pluginEnabled) return;

  const [source, archived] = await Promise.all([
    readOptional(storePath),
    readOptional(archivePath),
  ]);
  if (source === undefined) {
    if (archived === undefined) return;
    let archive;
    try {
      archive = JSON.parse(archived);
    } catch {
      throw new Error("sg-workspace-membership-migration-archive-invalid");
    }
    if (!validateArchive(archive)) {
      throw new Error("sg-workspace-membership-migration-archive-invalid");
    }
    return;
  }

  let store;
  try {
    store = JSON.parse(source);
  } catch {
    throw new Error("sg-workspace-membership-migration-unrecognized-store");
  }
  if (!validateStore(store)) {
    throw new Error("sg-workspace-membership-migration-unrecognized-store");
  }

  const sourceChecksum = checksum(source);
  if (archived !== undefined) {
    let archive;
    try {
      archive = JSON.parse(archived);
    } catch {
      throw new Error("sg-workspace-membership-migration-archive-invalid");
    }
    if (
      !validateArchive(archive) ||
      archive.sourceChecksum !== sourceChecksum ||
      archive.legacyRecordsChecksum !== legacyRecordsChecksum(store)
    ) {
      throw new Error("sg-workspace-membership-migration-archive-conflict");
    }
    await unlink(storePath);
    return;
  }

  const archive = {
    migrationVersion: MIGRATION_VERSION,
    archivedAt: new Date().toISOString(),
    sourceStoreVersion: 1,
    sourceChecksum,
    legacyRecordsChecksum: legacyRecordsChecksum(store),
    memberships: store.memberships,
    audit: store.audit,
  };
  await writeAtomically(archivePath, normalizedJson(archive));
  const writtenArchive = JSON.parse(await readFile(archivePath, "utf8"));
  if (!validateArchive(writtenArchive) || writtenArchive.sourceChecksum !== sourceChecksum) {
    throw new Error("sg-workspace-membership-migration-archive-verification-failed");
  }
  await unlink(storePath);
}

try {
  await migrate();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
