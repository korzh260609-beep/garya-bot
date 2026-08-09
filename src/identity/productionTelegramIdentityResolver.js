import { createIdentityContext, createScopeContext } from '../contracts/context.js';
import { PRODUCTION_CAPABILITY_NAMES } from '../capability/productionCapabilities.js';
import { TEMPORAL_CAPABILITY_NAMES, TEMPORAL_SAFE_CAPABILITY_NAMES } from '../temporal/temporalCapabilities.js';
import { LANGUAGE_CAPABILITY_NAMES, LANGUAGE_SAFE_CAPABILITY_NAMES } from '../language/languageCapabilities.js';
import { USER_SETTINGS_CAPABILITY_NAMES, USER_SETTINGS_SAFE_CAPABILITY_NAMES } from '../settings/userSettingsCapabilities.js';
import { BUILT_IN_DOMAIN_PERMISSIONS } from '../domains/builtInDomains.js';
import { generateGlobalUserId, isCanonicalGlobalUserId, isLegacyPlatformGlobalUserId } from './globalUserId.js';

const ALL_CAPABILITY_NAMES = Object.freeze([
  ...PRODUCTION_CAPABILITY_NAMES,
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

function clean(value) {
  return value == null ? '' : String(value).trim();
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function migrateLegacyGlobalUserId({ persistence, fromGlobalUserId, toGlobalUserId }) {
  if (fromGlobalUserId === toGlobalUserId) return toGlobalUserId;
  if (!persistence?.database?.transaction) throw new Error('legacy global identity migration requires transactional PostgreSQL persistence');

  await persistence.database.transaction(async (tx) => {
    const oldUser = await tx.query('SELECT profile FROM users WHERE global_user_id=$1', [fromGlobalUserId]);
    const oldProfile = oldUser.rows?.[0]?.profile ?? {};

    await tx.query(`INSERT INTO users(global_user_id, profile) VALUES ($1,$2::jsonb)
      ON CONFLICT(global_user_id) DO UPDATE SET profile = users.profile || EXCLUDED.profile, updated_at = now()`,
      [toGlobalUserId, JSON.stringify(oldProfile)]);

    // Merge access rows explicitly because their unique keys include global_user_id.
    await tx.query(`INSERT INTO roles(global_user_id, project_scope, role)
      SELECT $1, project_scope, role FROM roles WHERE global_user_id=$2 ON CONFLICT DO NOTHING`, [toGlobalUserId, fromGlobalUserId]);
    await tx.query('DELETE FROM roles WHERE global_user_id=$1', [fromGlobalUserId]);

    await tx.query(`INSERT INTO grants(global_user_id, project_scope, grant_name, constraints)
      SELECT $1, project_scope, grant_name, constraints FROM grants WHERE global_user_id=$2
      ON CONFLICT(global_user_id, project_scope, grant_name) DO UPDATE SET constraints=EXCLUDED.constraints`, [toGlobalUserId, fromGlobalUserId]);
    await tx.query('DELETE FROM grants WHERE global_user_id=$1', [fromGlobalUserId]);

    // User settings use a stable project_scope_key uniqueness boundary in SG 2.1.
    const settingsTable = await tx.query("SELECT to_regclass(current_schema() || '.user_settings') AS name");
    if (settingsTable.rows?.[0]?.name) {
      await tx.query(`INSERT INTO user_settings(global_user_id, project_scope, project_scope_key, settings, version, created_at, updated_at)
        SELECT $1, project_scope, project_scope_key, settings, version, created_at, updated_at
        FROM user_settings WHERE global_user_id=$2
        ON CONFLICT(global_user_id, project_scope_key) DO UPDATE
        SET settings=EXCLUDED.settings, version=GREATEST(user_settings.version, EXCLUDED.version), updated_at=now()`, [toGlobalUserId, fromGlobalUserId]);
      await tx.query('DELETE FROM user_settings WHERE global_user_id=$1', [fromGlobalUserId]);
    }

    // Move all remaining SG 2.1 records that use the canonical global_user_id column.
    const tables = await tx.query(`SELECT table_name FROM information_schema.columns
      WHERE table_schema=current_schema() AND column_name='global_user_id'
      AND table_name <> ALL($1::text[]) ORDER BY table_name`,
      [['users', 'roles', 'grants', 'user_settings']]);

    for (const { table_name: tableName } of tables.rows) {
      await tx.query(`UPDATE ${quoteIdentifier(tableName)} SET global_user_id=$1 WHERE global_user_id=$2`, [toGlobalUserId, fromGlobalUserId]);
    }

    await tx.query('DELETE FROM users WHERE global_user_id=$1', [fromGlobalUserId]);
  });

  return toGlobalUserId;
}

export function createProductionTelegramIdentityResolver({
  persistence,
  projectScope,
  monarchTelegramUserId = null,
  monarchGlobalUserId = null,
  temporalService = null,
  monarchTimeZone = null,
  languageContextService = null,
  monarchLanguage = null
} = {}) {
  if (!persistence?.repositories?.identities || !persistence?.repositories?.access) {
    throw new TypeError('PostgreSQL persistence repositories are required');
  }

  const configuredMonarchTelegramUserId = clean(monarchTelegramUserId);
  const configuredMonarchGlobalUserId = clean(monarchGlobalUserId);
  const configuredMonarchTimeZone = clean(monarchTimeZone);
  const configuredMonarchLanguage = clean(monarchLanguage).toLowerCase();

  if (configuredMonarchGlobalUserId && !isCanonicalGlobalUserId(configuredMonarchGlobalUserId)) {
    throw new TypeError('MONARCH_GLOBAL_USER_ID must be a canonical usr_ global user id');
  }
  if (configuredMonarchTelegramUserId && !configuredMonarchGlobalUserId) {
    throw new TypeError('MONARCH_GLOBAL_USER_ID is required when MONARCH_USER_ID/SG_MONARCH_TELEGRAM_USER_ID is configured');
  }
  if (configuredMonarchTimeZone && (!temporalService || !temporalService.isValidTimeZone(configuredMonarchTimeZone))) {
    throw new TypeError('SG_MONARCH_TIMEZONE must be a valid IANA timezone');
  }

  async function ensureRawGrant(globalUserId, project, currentGrants, grantName) {
    if (!currentGrants.has(grantName)) {
      await persistence.repositories.access.grantPermission({ globalUserId, projectScope: project, grantName });
      currentGrants.add(grantName);
    }
  }
  async function ensureGrant(globalUserId, project, currentGrants, name) {
    return ensureRawGrant(globalUserId, project, currentGrants, `capability:${name}`);
  }

  return async ({ platformFacts, scopeFacts }) => {
    const platform = clean(platformFacts?.platform);
    const platformUserId = clean(platformFacts?.platformUserId);
    if (platform !== 'telegram' || !platformUserId) throw new TypeError('Telegram platform identity is required');

    const effectiveProjectScope = clean(scopeFacts?.projectId ?? projectScope);
    const isConfiguredMonarchTelegramAccount = Boolean(configuredMonarchTelegramUserId) && platformUserId === configuredMonarchTelegramUserId;
    const existingLink = await persistence.repositories.identities.resolve(platform, platformUserId);

    let globalUserId;
    if (!existingLink) {
      globalUserId = isConfiguredMonarchTelegramAccount
        ? configuredMonarchGlobalUserId
        : generateGlobalUserId();
      await persistence.repositories.identities.link({
        platform,
        platformUserId,
        globalUserId,
        metadata: { source: 'telegram-production', canonicalGlobalIdentity: true }
      });
    } else {
      globalUserId = clean(existingLink.global_user_id);
      if (isLegacyPlatformGlobalUserId(globalUserId, { platform, platformUserId })) {
        const canonicalTarget = isConfiguredMonarchTelegramAccount
          ? configuredMonarchGlobalUserId
          : generateGlobalUserId();
        globalUserId = await migrateLegacyGlobalUserId({ persistence, fromGlobalUserId: globalUserId, toGlobalUserId: canonicalTarget });
      }
    }

    if (!isCanonicalGlobalUserId(globalUserId)) {
      throw new Error('resolved global identity is not canonical');
    }

    // Monarch authority is rooted only in the canonical SG global identity.
    const isMonarch = Boolean(configuredMonarchGlobalUserId) && globalUserId === configuredMonarchGlobalUserId;

    let access = await persistence.repositories.access.list({ globalUserId, projectScope: effectiveProjectScope });
    const existing = new Set(access.grants.map((grant) => grant.grant_name));

    if (isMonarch) {
      if (!access.roles.includes('monarch')) {
        await persistence.repositories.access.grantRole({ globalUserId, projectScope: effectiveProjectScope, role: 'monarch' });
      }
      for (const name of ALL_CAPABILITY_NAMES) await ensureGrant(globalUserId, effectiveProjectScope, existing, name);
      for (const grantName of BUILT_IN_DOMAIN_PERMISSIONS) await ensureRawGrant(globalUserId, effectiveProjectScope, existing, grantName);

      if (configuredMonarchTimeZone && temporalService && !(await temporalService.getUserTimezone(globalUserId))) {
        await temporalService.setUserTimezone(globalUserId, configuredMonarchTimeZone, { source: 'deployment-config', provenance: { env: 'SG_MONARCH_TIMEZONE' } });
      }
      if (configuredMonarchLanguage && languageContextService && !(await languageContextService.getPreferred(globalUserId))) {
        await languageContextService.setPreferred(globalUserId, configuredMonarchLanguage, { source: 'deployment-config', provenance: { env: 'SG_MONARCH_LANGUAGE' } });
      }
      access = await persistence.repositories.access.list({ globalUserId, projectScope: effectiveProjectScope });
    } else {
      // Never infer monarch from a platform ID or previously returned model text.
      const safeRoles = access.roles.filter((role) => role !== 'monarch');
      if (safeRoles.length === 0 && access.grants.length === 0) {
        await persistence.repositories.access.grantRole({ globalUserId, projectScope: effectiveProjectScope, role: 'guest' });
        await ensureGrant(globalUserId, effectiveProjectScope, existing, 'compose-answer');
      }
      for (const name of SAFE_GUEST_CAPABILITIES) await ensureGrant(globalUserId, effectiveProjectScope, existing, name);
      access = await persistence.repositories.access.list({ globalUserId, projectScope: effectiveProjectScope });
    }

    const roles = isMonarch ? access.roles : access.roles.filter((role) => role !== 'monarch');
    const grants = access.grants.map((grant) => grant.grant_name);
    const allowedCapabilities = grants
      .filter((grant) => grant.startsWith('capability:'))
      .map((grant) => grant.slice('capability:'.length));

    return {
      identityContext: createIdentityContext({
        globalUserId,
        platform,
        platformUserId,
        linkStatus: 'linked',
        roles,
        grants,
        authenticationLevel: 'telegram-webhook'
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
