#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const MIGRATION_VERSION = 1;
const stateDir = process.env.OPENCLAW_STATE_DIR || "/data/.openclaw";
const sgDir = path.join(stateDir, "sg");
const storePath = path.join(sgDir, "global-profiles.json");
const archivePath = path.join(
  sgDir,
  "archive",
  `global-profiles-citizenship-v${MIGRATION_VERSION}.json`,
);
const pluginEnabled = process.env.SG_WORKSPACE_PLUGIN_ENABLED !== "false";
const legacyTs = "1970-01-01T00:00:00.000Z";

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const clean = (value) => (typeof value === "string" ? value.trim() : "");
const canonical = (value) => clean(value).toLowerCase();
const timestamp = (value, fallback = legacyTs) => {
  const candidate = clean(value);
  return candidate && !Number.isNaN(Date.parse(candidate)) ? candidate : fallback;
};
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
  const tmp = `${filePath}.migrate-${process.pid}.tmp`;
  await writeFile(tmp, text, { mode: 0o600 });
  await rename(tmp, filePath);
}

function normalizeProfile(value, canonicalHint = "") {
  if (!isObject(value)) return null;
  const globalId = clean(value.globalId);
  const canonicalIdentity = canonical(value.canonicalIdentity) || canonical(canonicalHint);
  if (!globalId || !canonicalIdentity) return null;
  const createdAt = timestamp(value.createdAt, timestamp(value.updatedAt));
  return {
    globalId,
    canonicalIdentity,
    role: clean(value.role),
    status: clean(value.status),
    createdAt,
    updatedAt: timestamp(value.updatedAt, createdAt),
  };
}

function normalizeIdentity(value) {
  if (!isObject(value)) return null;
  const canonicalIdentity = canonical(value.canonicalIdentity);
  const globalId = clean(value.globalId);
  if (!canonicalIdentity || !globalId) return null;
  const createdAt = timestamp(value.createdAt, timestamp(value.updatedAt));
  return {
    canonicalIdentity,
    globalId,
    createdAt,
    updatedAt: timestamp(value.updatedAt, createdAt),
  };
}

function collect(raw) {
  const result = {
    sourceVersion: null,
    monarchGlobalId: "",
    profiles: [],
    identities: [],
    citizenRequests: [],
    audit: [],
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const profile = normalizeProfile(item);
      if (!profile) throw new Error("sg-global-profile-migration-invalid-profile");
      result.profiles.push(profile);
    }
    return result;
  }
  if (!isObject(raw)) throw new Error("sg-global-profile-migration-unrecognized-store");
  if (Object.keys(raw).length === 0) return result;

  result.sourceVersion = Number.isInteger(raw.version) ? raw.version : null;
  result.monarchGlobalId = clean(raw.monarchGlobalId);

  if (raw.version !== undefined && ![2, 3, 4, 5].includes(raw.version)) {
    throw new Error("sg-global-profile-migration-unsupported-version");
  }

  if ([2, 3, 4, 5].includes(raw.version)) {
    if (!Array.isArray(raw.profiles) || !Array.isArray(raw.identities)) {
      throw new Error("sg-global-profile-migration-unrecognized-store");
    }
    if (
      [3, 4].includes(raw.version) &&
      (!Array.isArray(raw.citizenRequests) || !Array.isArray(raw.audit))
    ) {
      throw new Error("sg-global-profile-migration-unrecognized-store");
    }
    if (
      raw.version === 5 &&
      ((raw.citizenRequests !== undefined && !Array.isArray(raw.citizenRequests)) ||
        (raw.audit !== undefined && !Array.isArray(raw.audit)))
    ) {
      throw new Error("sg-global-profile-migration-unrecognized-store");
    }
  }

  if (Array.isArray(raw.profiles)) {
    for (const item of raw.profiles) {
      const profile = normalizeProfile(item);
      if (!profile) throw new Error("sg-global-profile-migration-invalid-profile");
      result.profiles.push(profile);
    }
  } else if (isObject(raw.profiles)) {
    for (const [identity, item] of Object.entries(raw.profiles)) {
      const profile = normalizeProfile(item, identity);
      if (!profile) throw new Error("sg-global-profile-migration-invalid-profile");
      result.profiles.push(profile);
    }
  } else if (raw.version === undefined) {
    for (const [identity, item] of Object.entries(raw)) {
      const profile = normalizeProfile(item, identity);
      if (!profile) throw new Error("sg-global-profile-migration-unrecognized-store");
      result.profiles.push(profile);
    }
  } else {
    throw new Error("sg-global-profile-migration-unrecognized-store");
  }

  if (Array.isArray(raw.identities)) {
    for (const item of raw.identities) {
      const identity = normalizeIdentity(item);
      if (!identity) throw new Error("sg-global-profile-migration-invalid-identity");
      result.identities.push(identity);
    }
  }
  if (Array.isArray(raw.citizenRequests)) result.citizenRequests = raw.citizenRequests;
  if (Array.isArray(raw.audit)) result.audit = raw.audit;
  return result;
}

function migrationGlobalId(canonicalIdentity) {
  return `usr_migrated_${checksum(canonicalIdentity)}`;
}

function buildMigratedStore(collected) {
  const profilesById = new Map();
  const primaryIdentityToId = new Map();
  const linksByCanonical = new Map();

  const addProfile = (profile) => {
    const existingById = profilesById.get(profile.globalId);
    if (existingById && existingById.canonicalIdentity !== profile.canonicalIdentity) {
      throw new Error("sg-global-profile-migration-global-id-ambiguity");
    }
    const existingId = primaryIdentityToId.get(profile.canonicalIdentity);
    if (existingId && existingId !== profile.globalId) {
      throw new Error("sg-global-profile-migration-canonical-identity-ambiguity");
    }
    if (!existingById) profilesById.set(profile.globalId, { ...profile });
    primaryIdentityToId.set(profile.canonicalIdentity, profile.globalId);
  };

  const addLink = (identity) => {
    const existing = linksByCanonical.get(identity.canonicalIdentity);
    if (existing && existing.globalId !== identity.globalId) {
      throw new Error("sg-global-profile-migration-canonical-identity-ambiguity");
    }
    if (!existing) linksByCanonical.set(identity.canonicalIdentity, { ...identity });
  };

  for (const profile of collected.profiles) addProfile(profile);
  for (const profile of profilesById.values()) {
    addLink({
      canonicalIdentity: profile.canonicalIdentity,
      globalId: profile.globalId,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    });
  }

  for (const identity of collected.identities) {
    addLink(identity);
    if (!profilesById.has(identity.globalId)) {
      addProfile({
        globalId: identity.globalId,
        canonicalIdentity: identity.canonicalIdentity,
        role: "citizen",
        status: "active",
        createdAt: identity.createdAt,
        updatedAt: identity.updatedAt,
      });
    }
  }

  const requestIdHints = new Map();
  for (const event of collected.audit) {
    if (!isObject(event)) continue;
    const requestIdentity = canonical(event.canonicalIdentity);
    const resultingGlobalId = clean(event.resultingGlobalId);
    if (!requestIdentity || !resultingGlobalId) continue;
    const current = requestIdHints.get(requestIdentity);
    if (current && current !== resultingGlobalId) {
      throw new Error("sg-global-profile-migration-request-global-id-ambiguity");
    }
    requestIdHints.set(requestIdentity, resultingGlobalId);
  }

  for (const request of collected.citizenRequests) {
    if (!isObject(request)) continue;
    const requestIdentity = canonical(request.canonicalIdentity);
    if (!requestIdentity || !["pending", "approved", "rejected"].includes(request.status)) continue;
    const requestGlobalId = clean(request.resultingGlobalId);
    const auditGlobalId = requestIdHints.get(requestIdentity) || "";
    if (requestGlobalId && auditGlobalId && requestGlobalId !== auditGlobalId) {
      throw new Error("sg-global-profile-migration-request-global-id-ambiguity");
    }
    const hintedGlobalId = requestGlobalId || auditGlobalId;
    const existingLink = linksByCanonical.get(requestIdentity);
    if (existingLink && hintedGlobalId && existingLink.globalId !== hintedGlobalId) {
      throw new Error("sg-global-profile-migration-request-global-id-ambiguity");
    }
    if (existingLink) continue;

    const globalId = hintedGlobalId || migrationGlobalId(requestIdentity);
    const createdAt = timestamp(request.createdAt);
    const updatedAt = timestamp(request.updatedAt, createdAt);
    const existingProfile = profilesById.get(globalId);
    if (!existingProfile) {
      addProfile({
        globalId,
        canonicalIdentity: requestIdentity,
        role: "citizen",
        status: "active",
        createdAt,
        updatedAt,
      });
    }
    addLink({ canonicalIdentity: requestIdentity, globalId, createdAt, updatedAt });
  }

  const configuredGlobalId = clean(process.env.SG_MONARCH_GLOBAL_USER_ID);
  const telegramId = clean(process.env.SG_MONARCH_TELEGRAM_USER_ID || process.env.MONARCH_USER_ID)
    .replace(/^telegram:/iu, "")
    .trim()
    .toLowerCase();
  const configuredCanonicalIdentity = telegramId ? `channel:telegram:${telegramId}` : "";
  if (pluginEnabled && (!configuredGlobalId || !configuredCanonicalIdentity)) {
    throw new Error("sg-monarch-configuration-invalid");
  }
  if (
    collected.monarchGlobalId &&
    configuredGlobalId &&
    collected.monarchGlobalId !== configuredGlobalId
  ) {
    throw new Error("sg-monarch-global-id-conflict");
  }

  if (configuredGlobalId && configuredCanonicalIdentity) {
    const configuredLink = linksByCanonical.get(configuredCanonicalIdentity);
    if (configuredLink && configuredLink.globalId !== configuredGlobalId) {
      throw new Error("sg-monarch-identity-conflict");
    }
    const now = new Date().toISOString();
    const existingMonarch = profilesById.get(configuredGlobalId);
    if (!existingMonarch) {
      addProfile({
        globalId: configuredGlobalId,
        canonicalIdentity: configuredCanonicalIdentity,
        role: "monarch",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    } else if (existingMonarch.canonicalIdentity !== configuredCanonicalIdentity) {
      addLink({
        canonicalIdentity: existingMonarch.canonicalIdentity,
        globalId: existingMonarch.globalId,
        createdAt: existingMonarch.createdAt,
        updatedAt: existingMonarch.updatedAt,
      });
      primaryIdentityToId.delete(existingMonarch.canonicalIdentity);
      existingMonarch.canonicalIdentity = configuredCanonicalIdentity;
      primaryIdentityToId.set(configuredCanonicalIdentity, configuredGlobalId);
    }
    const monarchProfile = profilesById.get(configuredGlobalId);
    addLink({
      canonicalIdentity: configuredCanonicalIdentity,
      globalId: configuredGlobalId,
      createdAt: monarchProfile.createdAt,
      updatedAt: monarchProfile.updatedAt,
    });
  }

  for (const profile of profilesById.values()) {
    profile.role = profile.globalId === configuredGlobalId ? "monarch" : "citizen";
    profile.status = "active";
  }

  const profiles = [...profilesById.values()].sort((left, right) =>
    left.globalId < right.globalId ? -1 : left.globalId > right.globalId ? 1 : 0,
  );
  const identities = [...linksByCanonical.values()].sort((left, right) =>
    left.canonicalIdentity < right.canonicalIdentity
      ? -1
      : left.canonicalIdentity > right.canonicalIdentity
        ? 1
        : 0,
  );
  const profileIds = new Set(profiles.map((profile) => profile.globalId));
  if (
    profiles.filter((profile) => profile.role === "monarch").length !== (pluginEnabled ? 1 : 0) ||
    identities.some((identity) => !profileIds.has(identity.globalId))
  ) {
    throw new Error("sg-global-profile-migration-validation-failed");
  }

  return {
    version: 5,
    ...(configuredGlobalId ? { monarchGlobalId: configuredGlobalId } : {}),
    profiles,
    identities,
  };
}

function validateArchive(value) {
  if (!isObject(value) || value.migrationVersion !== MIGRATION_VERSION) {
    throw new Error("sg-global-profile-migration-archive-invalid");
  }
  if (!Array.isArray(value.citizenRequests) || !Array.isArray(value.audit)) {
    throw new Error("sg-global-profile-migration-archive-invalid");
  }
  if (
    Number.isNaN(Date.parse(clean(value.archivedAt))) ||
    !/^[a-f0-9]{64}$/u.test(clean(value.sourceChecksum)) ||
    !/^[a-f0-9]{64}$/u.test(clean(value.legacyRecordsChecksum))
  ) {
    throw new Error("sg-global-profile-migration-archive-invalid");
  }
  const payload = JSON.stringify({ citizenRequests: value.citizenRequests, audit: value.audit });
  if (value.legacyRecordsChecksum !== checksum(payload)) {
    throw new Error("sg-global-profile-migration-archive-checksum-invalid");
  }
  return value;
}

async function main() {
  if (!pluginEnabled) {
    console.log(`[sg] global profile migration v${MIGRATION_VERSION}: skipped (plugin disabled)`);
    return;
  }

  await mkdir(sgDir, { recursive: true });
  const sourceText = (await readOptional(storePath)) ?? "{}";
  let raw;
  try {
    raw = JSON.parse(sourceText);
  } catch {
    throw new Error("sg-global-profile-migration-invalid-json");
  }

  const collected = collect(raw);
  const migrated = buildMigratedStore(collected);
  const migratedText = normalizedJson(migrated);
  const legacyPayload = {
    citizenRequests: collected.citizenRequests,
    audit: collected.audit,
  };
  const legacyRecordsChecksum = checksum(JSON.stringify(legacyPayload));
  const existingArchiveText = await readOptional(archivePath);

  if (existingArchiveText === undefined) {
    const archive = {
      migrationVersion: MIGRATION_VERSION,
      archivedAt: new Date().toISOString(),
      sourceStoreVersion: collected.sourceVersion,
      sourceChecksum: checksum(sourceText),
      legacyRecordsChecksum,
      citizenRequests: collected.citizenRequests,
      audit: collected.audit,
    };
    await writeAtomically(archivePath, normalizedJson(archive));
  } else {
    let archive;
    try {
      archive = validateArchive(JSON.parse(existingArchiveText));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("sg-global-profile-migration-archive-invalid");
      }
      throw error;
    }
    if (
      (collected.citizenRequests.length > 0 || collected.audit.length > 0) &&
      archive.legacyRecordsChecksum !== legacyRecordsChecksum
    ) {
      throw new Error("sg-global-profile-migration-archive-conflict");
    }
  }

  if (sourceText !== migratedText) await writeAtomically(storePath, migratedText);
  const reloadedText = await readFile(storePath, "utf8");
  let reloaded;
  try {
    reloaded = JSON.parse(reloadedText);
  } catch {
    throw new Error("sg-global-profile-migration-write-verification-failed");
  }
  const expectedBindings = migrated.identities.map(
    (identity) => `${identity.canonicalIdentity}\u0000${identity.globalId}`,
  );
  const reloadedBindings = Array.isArray(reloaded.identities)
    ? reloaded.identities.map(
        (identity) => `${identity.canonicalIdentity}\u0000${identity.globalId}`,
      )
    : [];
  if (
    reloadedText !== migratedText ||
    reloaded.profiles?.length !== migrated.profiles.length ||
    reloadedBindings.length !== expectedBindings.length ||
    reloadedBindings.some((binding, index) => binding !== expectedBindings[index])
  ) {
    throw new Error("sg-global-profile-migration-write-verification-failed");
  }
  console.log(
    `[sg] global profile migration v${MIGRATION_VERSION}: ` +
      `${migrated.profiles.length} profiles, ${migrated.identities.length} identities, ` +
      `archive=${path.basename(archivePath)}`,
  );
}

await main();
