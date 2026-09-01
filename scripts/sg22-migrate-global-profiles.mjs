#!/usr/bin/env node
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const stateDir = process.env.OPENCLAW_STATE_DIR || "/data/.openclaw";
const storePath = path.join(stateDir, "sg", "global-profiles.json");
const legacyTs = "1970-01-01T00:00:00.000Z";
const roleRank = { guest: 0, citizen: 1, monarch: 2 };

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const clean = (value) => (typeof value === "string" ? value.trim() : "");
const validRole = (value) => ["guest", "citizen", "monarch"].includes(value) ? value : "guest";
const validStatus = (value) => ["active", "suspended", "archived"].includes(value) ? value : "active";

function normalizeProfile(value, canonicalHint = "") {
  if (!isObject(value)) return null;
  const globalId = clean(value.globalId);
  const canonicalIdentity = clean(value.canonicalIdentity) || clean(canonicalHint);
  if (!globalId || !canonicalIdentity) return null;
  const createdAt = clean(value.createdAt) || clean(value.updatedAt) || legacyTs;
  const updatedAt = clean(value.updatedAt) || createdAt;
  return {
    globalId,
    canonicalIdentity,
    role: validRole(value.role),
    status: validStatus(value.status),
    createdAt,
    updatedAt,
  };
}

function normalizeIdentity(value) {
  if (!isObject(value)) return null;
  const canonicalIdentity = clean(value.canonicalIdentity);
  const globalId = clean(value.globalId);
  if (!canonicalIdentity || !globalId) return null;
  const createdAt = clean(value.createdAt) || clean(value.updatedAt) || legacyTs;
  const updatedAt = clean(value.updatedAt) || createdAt;
  return { canonicalIdentity, globalId, createdAt, updatedAt };
}

function collect(raw) {
  const profiles = [];
  const identities = [];
  const citizenRequests = [];
  const audit = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const profile = normalizeProfile(item);
      if (profile) profiles.push(profile);
    }
    return { profiles, identities, citizenRequests, audit };
  }

  if (!isObject(raw)) return { profiles, identities, citizenRequests, audit };

  if (Array.isArray(raw.profiles)) {
    for (const item of raw.profiles) {
      const profile = normalizeProfile(item);
      if (profile) profiles.push(profile);
    }
  } else if (isObject(raw.profiles)) {
    for (const [canonical, item] of Object.entries(raw.profiles)) {
      const profile = normalizeProfile(item, canonical);
      if (profile) profiles.push(profile);
    }
  } else if (raw.version === undefined) {
    for (const [canonical, item] of Object.entries(raw)) {
      const profile = normalizeProfile(item, canonical);
      if (profile) profiles.push(profile);
    }
  }

  if (Array.isArray(raw.identities)) {
    for (const item of raw.identities) {
      const identity = normalizeIdentity(item);
      if (identity) identities.push(identity);
    }
  }

  if (raw.version === 3 && Array.isArray(raw.citizenRequests)) {
    citizenRequests.push(...raw.citizenRequests);
  }
  if (raw.version === 3 && Array.isArray(raw.audit)) {
    audit.push(...raw.audit);
  }

  return { profiles, identities, citizenRequests, audit };
}

function repair(raw) {
  const collected = collect(raw);
  const byGlobalId = new Map();

  for (const profile of collected.profiles) {
    const current = byGlobalId.get(profile.globalId);
    if (!current) {
      byGlobalId.set(profile.globalId, profile);
      continue;
    }
    const preferred = roleRank[profile.role] > roleRank[current.role] ? profile : current;
    byGlobalId.set(profile.globalId, {
      ...current,
      ...preferred,
      globalId: current.globalId,
      canonicalIdentity: current.canonicalIdentity || preferred.canonicalIdentity,
      createdAt: current.createdAt < preferred.createdAt ? current.createdAt : preferred.createdAt,
      updatedAt: current.updatedAt > preferred.updatedAt ? current.updatedAt : preferred.updatedAt,
    });
  }

  const profiles = [...byGlobalId.values()];
  const profileIds = new Set(profiles.map((profile) => profile.globalId));
  const byCanonical = new Map();

  for (const identity of collected.identities) {
    if (!profileIds.has(identity.globalId)) continue;
    if (!byCanonical.has(identity.canonicalIdentity)) {
      byCanonical.set(identity.canonicalIdentity, identity);
    }
  }

  for (const profile of profiles) {
    if (!byCanonical.has(profile.canonicalIdentity)) {
      byCanonical.set(profile.canonicalIdentity, {
        canonicalIdentity: profile.canonicalIdentity,
        globalId: profile.globalId,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      });
    }
  }

  return {
    version: 3,
    profiles,
    identities: [...byCanonical.values()],
    citizenRequests: collected.citizenRequests,
    audit: collected.audit,
  };
}

function seedMonarch(store) {
  const globalId = clean(process.env.SG_MONARCH_GLOBAL_USER_ID);
  const telegramId = clean(process.env.SG_MONARCH_TELEGRAM_USER_ID || process.env.MONARCH_USER_ID)
    .replace(/^telegram:/i, "")
    .trim();
  if (!globalId || !telegramId) return store;
  const now = new Date().toISOString();
  const canonicalIdentity = `channel:telegram:${telegramId.toLowerCase()}`;
  let profile = store.profiles.find((item) => item.globalId === globalId);
  if (!profile) {
    profile = { globalId, canonicalIdentity, role: "monarch", status: "active", createdAt: now, updatedAt: now };
    store.profiles.push(profile);
  } else if (profile.role !== "monarch" || profile.status !== "active") {
    profile.role = "monarch";
    profile.status = "active";
    profile.updatedAt = now;
  }
  const link = store.identities.find((item) => item.canonicalIdentity === canonicalIdentity);
  if (link) {
    if (link.globalId !== globalId) {
      link.globalId = globalId;
      link.updatedAt = now;
    }
  } else {
    store.identities.push({ canonicalIdentity, globalId, createdAt: now, updatedAt: now });
  }
  return store;
}

async function main() {
  await mkdir(path.dirname(storePath), { recursive: true });
  let text;
  try {
    text = await readFile(storePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") text = "{}";
    else throw error;
  }

  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    const backup = `${storePath}.invalid-json-${Date.now()}.bak`;
    await copyFile(storePath, backup);
    console.error(`[sg] global profile JSON is invalid; backup saved to ${backup}; rebuilding an empty valid store`);
    raw = { version: 3, profiles: [], identities: [], citizenRequests: [], audit: [] };
  }

  let repaired = repair(raw);
  if (
    repaired.profiles.length === 0 &&
    text.trim() &&
    text.trim() !== "{}" &&
    text.trim() !== "[]" &&
    !(
      isObject(raw) &&
      [2, 3].includes(raw.version) &&
      Array.isArray(raw.profiles) &&
      Array.isArray(raw.identities)
    )
  ) {
    const backup = `${storePath}.unrecognized-${Date.now()}.bak`;
    await copyFile(storePath, backup);
    console.error(`[sg] global profile store format is unrecognized; backup saved to ${backup}; rebuilding an empty valid store`);
    repaired = { version: 3, profiles: [], identities: [], citizenRequests: [], audit: [] };
  }
  repaired = seedMonarch(repaired);

  const normalized = `${JSON.stringify(repaired, null, 2)}\n`;
  if (normalized === `${JSON.stringify(raw, null, 2)}\n`) return;

  const tmp = `${storePath}.migrate-${process.pid}.tmp`;
  await writeFile(tmp, normalized, { mode: 0o600 });
  await rename(tmp, storePath);
  console.log(`[sg] global profile store migrated/repaired: ${repaired.profiles.length} profiles, ${repaired.identities.length} identities`);
}

await main();
