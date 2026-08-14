import { createDescriptiveIdentityProfile, createIdentityContext, createScopeContext } from '../contracts/context.js';
import { PRODUCTION_CAPABILITY_NAMES } from '../capability/productionCapabilities.js';
import { MEMORY2_CAPABILITY_NAMES } from '../memory2/memory2Capabilities.js';
import { TEMPORAL_CAPABILITY_NAMES, TEMPORAL_SAFE_CAPABILITY_NAMES } from '../temporal/temporalCapabilities.js';
import { LANGUAGE_CAPABILITY_NAMES, LANGUAGE_SAFE_CAPABILITY_NAMES } from '../language/languageCapabilities.js';
import { USER_SETTINGS_CAPABILITY_NAMES, USER_SETTINGS_SAFE_CAPABILITY_NAMES } from '../settings/userSettingsCapabilities.js';
import { BUILT_IN_DOMAIN_PERMISSIONS } from '../domains/builtInDomains.js';
import { generateGlobalUserId, isCanonicalGlobalUserId, isLegacyPlatformGlobalUserId } from './globalUserId.js';

const ALL_CAPABILITY_NAMES = Object.freeze([
  ...PRODUCTION_CAPABILITY_NAMES,
  ...MEMORY2_CAPABILITY_NAMES,
  ...TEMPORAL_CAPABILITY_NAMES,
  ...LANGUAGE_CAPABILITY_NAMES,
  ...USER_SETTINGS_CAPABILITY_NAMES
]);

const SAFE_GUEST_CAPABILITIES = Object.freeze([
  'compose-answer',
  ...TEMPORAL_SAFE_CAPABILITY_NAMES,
  ...LANGUAGE_SAFE_CAPABILITY_NAMES,
  ...USER_SETTINGS_SAFE_CAPABILITY_NAMES
]);

function clean(value) { return value == null ? '' : String(value).trim(); }
function quoteIdentifier(value) { return `"${String(value).replaceAll('"', '""')}"`; }

async function allocateCanonicalGlobalUserId(persistence) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateGlobalUserId();
    if (!persistence?.repositories?.users?.get) return candidate;
    if (!(await persistence.repositories.users.get(candidate))) return candidate;
  }
  throw new Error('GLOBAL_USER_ID_GENERATION_FAILED');
}

async function migrateGlobalUserId({ persistence, fromGlobalUserId, toGlobalUserId }) {
  if (fromGlobalUserId === toGlobalUserId) return toGlobalUserId;
  if (!isCanonicalGlobalUserId(toGlobalUserId)) throw new TypeError('target global user id must be canonical');
  if (!persistence?.database?.transaction) throw new Error('global identity migration requires transactional PostgreSQL persistence');
  await persistence.database.transaction(async (tx) => {
    const oldUser = await tx.query('SELECT profile FROM users WHERE global_user_id=$1', [fromGlobalUserId]);
    const oldProfile = oldUser.rows?.[0]?.profile ?? {};
    await tx.query(`INSERT INTO users(global_user_id, profile) VALUES ($1,$2::jsonb)
      ON CONFLICT(global_user_id) DO UPDATE SET profile = users.profile || EXCLUDED.profile, updated_at = now()`,
      [toGlobalUserId, JSON.stringify(oldProfile)]);
    await tx.query(`INSERT INTO roles(global_user_id, project_scope, role)
      SELECT $1, project_scope, role FROM roles WHERE global_user_id=$2 ON CONFLICT DO NOTHING`, [toGlobalUserId, fromGlobalUserId]);
    await tx.query('DELETE FROM roles WHERE global_user_id=$1', [fromGlobalUserId]);
    await tx.query(`INSERT INTO grants(global_user_id, project_scope, grant_name, constraints)
      SELECT $1, project_scope, grant_name, constraints FROM grants WHERE global_user_id=$2
      ON CONFLICT(global_user_id, project_scope, grant_name) DO UPDATE SET constraints=EXCLUDED.constraints`, [toGlobalUserId, fromGlobalUserId]);
    await tx.query('DELETE FROM grants WHERE global_user_id=$1', [fromGlobalUserId]);
    const references = await tx.query(`SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema=current_schema() AND column_name LIKE '%global_user_id'
        AND NOT (column_name='global_user_id' AND table_name = ANY($1::text[]))
      ORDER BY table_name, ordinal_position`, [['users', 'roles', 'grants']]);
    for (const { table_name: tableName, column_name: columnName } of references.rows) {
      await tx.query(`UPDATE ${quoteIdentifier(tableName)} SET ${quoteIdentifier(columnName)}=$1 WHERE ${quoteIdentifier(columnName)}=$2`, [toGlobalUserId, fromGlobalUserId]);
    }
    await tx.query('DELETE FROM users WHERE global_user_id=$1', [fromGlobalUserId]);
  });
  return toGlobalUserId;
}

export function createProductionDiscordIdentityResolver({
  persistence,
  projectScope,
  monarchDiscordUserId = null,
  monarchGlobalUserId = null,
  temporalService = null,
  monarchTimeZone = null,
  languageContextService = null,
  monarchLanguage = null
} = {}) {
  if (!persistence?.repositories?.identities || !persistence?.repositories?.access) throw new TypeError('PostgreSQL persistence repositories are required');
  const configuredMonarchDiscordUserId = clean(monarchDiscordUserId);
  const configuredMonarchGlobalUserId = clean(monarchGlobalUserId);
  const configuredMonarchTimeZone = clean(monarchTimeZone);
  const configuredMonarchLanguage = clean(monarchLanguage).toLowerCase();
  if (configuredMonarchGlobalUserId && !isCanonicalGlobalUserId(configuredMonarchGlobalUserId)) throw new TypeError('SG_MONARCH_GLOBAL_USER_ID must be a canonical usr_ global user id');
  if (configuredMonarchDiscordUserId && !configuredMonarchGlobalUserId) throw new TypeError('SG_MONARCH_GLOBAL_USER_ID is required when SG_MONARCH_DISCORD_USER_ID is configured');
  if (configuredMonarchTimeZone && (!temporalService || !temporalService.isValidTimeZone(configuredMonarchTimeZone))) throw new TypeError('SG_MONARCH_TIMEZONE must be a valid IANA timezone');

  async function ensureRawGrant(globalUserId, project, currentGrants, grantName) {
    if (!currentGrants.has(grantName)) {
      await persistence.repositories.access.grantPermission({ globalUserId, projectScope: project, grantName });
      currentGrants.add(grantName);
    }
  }
  async function ensureGrant(globalUserId, project, currentGrants, name) { return ensureRawGrant(globalUserId, project, currentGrants, `capability:${name}`); }

  return async ({ platformFacts, scopeFacts }) => {
    const platform = clean(platformFacts?.platform);
    const platformUserId = clean(platformFacts?.platformUserId);
    if (platform !== 'discord' || !platformUserId) throw new TypeError('Discord platform identity is required');
    const effectiveProjectScope = clean(scopeFacts?.projectId ?? projectScope);
    const descriptiveProfile = createDescriptiveIdentityProfile(platformFacts?.profile);
    const isConfiguredMonarchDiscordAccount = Boolean(configuredMonarchDiscordUserId) && platformUserId === configuredMonarchDiscordUserId;
    const existingLink = await persistence.repositories.identities.resolve(platform, platformUserId);

    let globalUserId;
    if (!existingLink) {
      globalUserId = isConfiguredMonarchDiscordAccount ? configuredMonarchGlobalUserId : await allocateCanonicalGlobalUserId(persistence);
      await persistence.repositories.identities.link({ platform, platformUserId, globalUserId, metadata: { source: 'discord-production', canonicalGlobalIdentity: true } });
    } else {
      globalUserId = clean(existingLink.global_user_id);
      const mustMoveConfiguredMonarch = isConfiguredMonarchDiscordAccount && globalUserId !== configuredMonarchGlobalUserId;
      const mustUpgradeLegacyUser = !isConfiguredMonarchDiscordAccount && isLegacyPlatformGlobalUserId(globalUserId, { platform, platformUserId });
      if (mustMoveConfiguredMonarch || mustUpgradeLegacyUser) {
        globalUserId = await migrateGlobalUserId({ persistence, fromGlobalUserId: globalUserId, toGlobalUserId: mustMoveConfiguredMonarch ? configuredMonarchGlobalUserId : await allocateCanonicalGlobalUserId(persistence) });
      }
    }
    if (!isCanonicalGlobalUserId(globalUserId)) throw new Error('resolved global identity is not canonical');

    if (descriptiveProfile && persistence.repositories.users?.upsert) await persistence.repositories.users.upsert({ globalUserId, profile: descriptiveProfile });
    const persistedUser = persistence.repositories.users?.get ? await persistence.repositories.users.get(globalUserId) : null;
    const persistedProfile = createDescriptiveIdentityProfile(persistedUser?.profile ?? descriptiveProfile);
    const isMonarch = Boolean(configuredMonarchGlobalUserId) && globalUserId === configuredMonarchGlobalUserId;
    let access = await persistence.repositories.access.list({ globalUserId, projectScope: effectiveProjectScope });

    if (!isMonarch && access.roles.includes('monarch') && persistence?.database?.query) {
      await persistence.database.query("DELETE FROM roles WHERE global_user_id=$1 AND project_scope=$2 AND role='monarch'", [globalUserId, effectiveProjectScope]);
      access = await persistence.repositories.access.list({ globalUserId, projectScope: effectiveProjectScope });
    }
    const existing = new Set(access.grants.map((grant) => grant.grant_name));
    if (isMonarch) {
      if (!access.roles.includes('monarch')) await persistence.repositories.access.grantRole({ globalUserId, projectScope: effectiveProjectScope, role: 'monarch' });
      for (const name of ALL_CAPABILITY_NAMES) await ensureGrant(globalUserId, effectiveProjectScope, existing, name);
      for (const grantName of ['memory:group:write', 'memory:project:write', 'memory:confirm', 'memory:promote', ...BUILT_IN_DOMAIN_PERMISSIONS]) await ensureRawGrant(globalUserId, effectiveProjectScope, existing, grantName);
      if (configuredMonarchTimeZone && temporalService && !(await temporalService.getUserTimezone(globalUserId))) await temporalService.setUserTimezone(globalUserId, configuredMonarchTimeZone, { source: 'deployment-config', provenance: { env: 'SG_MONARCH_TIMEZONE' } });
      if (configuredMonarchLanguage && languageContextService && !(await languageContextService.getPreferred(globalUserId))) await languageContextService.setPreferred(globalUserId, configuredMonarchLanguage, { source: 'deployment-config', provenance: { env: 'SG_MONARCH_LANGUAGE' } });
      access = await persistence.repositories.access.list({ globalUserId, projectScope: effectiveProjectScope });
    } else {
      if (access.roles.length === 0 && access.grants.length === 0) {
        await persistence.repositories.access.grantRole({ globalUserId, projectScope: effectiveProjectScope, role: 'guest' });
        await ensureGrant(globalUserId, effectiveProjectScope, existing, 'compose-answer');
      }
      for (const name of SAFE_GUEST_CAPABILITIES) await ensureGrant(globalUserId, effectiveProjectScope, existing, name);
      access = await persistence.repositories.access.list({ globalUserId, projectScope: effectiveProjectScope });
    }

    const roles = isMonarch ? access.roles : access.roles.filter((role) => role !== 'monarch');
    const grants = access.grants.map((grant) => grant.grant_name);
    const allowedCapabilities = grants.filter((grant) => grant.startsWith('capability:')).map((grant) => grant.slice('capability:'.length));
    return {
      identityContext: createIdentityContext({
        globalUserId,
        platform,
        platformUserId,
        linkStatus: 'linked',
        roles,
        grants,
        authenticationLevel: 'discord-gateway',
        profile: persistedProfile
      }),
      scopeContext: createScopeContext({
        userScope: globalUserId,
        projectScope: effectiveProjectScope,
        groupScope: scopeFacts?.groupId ?? null,
        threadScope: scopeFacts?.threadId ?? null,
        allowedCapabilities
      })
    };
  };
}
