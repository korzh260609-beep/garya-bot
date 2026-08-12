export {
  TELEGRAM_WORKSPACE_PLATFORM,
  TELEGRAM_WORKSPACE_TYPES,
  TELEGRAM_WORKSPACE_LIFECYCLE,
  TELEGRAM_WORKSPACE_ROLES,
  TELEGRAM_WORKSPACE_CONFIG_NAMESPACES,
  createTelegramWorkspace,
  normalizeWorkspaceMigration,
  migrateTelegramWorkspaceToSupergroup,
  canTransitionTelegramWorkspace,
  transitionTelegramWorkspace,
  createTelegramWorkspaceScope,
  assertTelegramWorkspaceScope,
  assertTelegramWorkspace,
  assertSameTelegramWorkspace,
  telegramWorkspaceConfigNamespace
} from './workspaceContract.js';

export {
  createPostgresTelegramWorkspaceStore,
  assertWorkspaceConfigContainsNoSecrets,
  TELEGRAM_WORKSPACE_PERSISTED_CONFIG_NAMESPACES
} from './postgresWorkspaceStore.js';

export { extractTelegramWorkspaceEvents } from './telegramWorkspaceDiscovery.js';
export { createTelegramWorkspaceRegistry } from './telegramWorkspaceRegistry.js';
export { createPostgresTelegramWorkspaceRegistry } from './postgresWorkspaceRegistry.js';
export {
  createTelegramWorkspaceDiscoveryIntegration,
  createTelegramWorkspaceDiscoveryUpdateStore
} from './telegramWorkspaceDiscoveryIntegration.js';
export {
  TELEGRAM_WORKSPACE_AUTHORITY_ACTIONS,
  createTelegramWorkspaceAuthorityResolver,
  createPostgresTelegramWorkspaceAuthorityResolver
} from './telegramWorkspaceAuthorityResolver.js';
export {
  TELEGRAM_WORKSPACE_BOT_CAPABILITIES,
  TelegramWorkspaceBotCapabilityError,
  createTelegramWorkspaceBotCapabilityService
} from './telegramWorkspaceBotCapabilityService.js';
export {
  TELEGRAM_WORKSPACE_CONFIGURATION_NAMESPACES,
  TELEGRAM_WORKSPACE_PERSISTENCE_NAMESPACES,
  TelegramWorkspaceConfigurationError,
  validateTelegramWorkspaceConfiguration,
  createTelegramWorkspaceConfigurationService
} from './workspaceConfigurationService.js';
