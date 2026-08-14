const RUNTIME_POLICY_VERSION = 'twm1.10';
const RESPONSE_MODES = new Set(['mention_only', 'all', 'off']);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) freeze(nested);
  return Object.freeze(value);
}

function chatFromUpdate(update) {
  return update?.message?.chat ?? update?.edited_message?.chat ?? update?.channel_post?.chat ?? null;
}

function configMap(rows) {
  const result = new Map();
  for (const row of rows ?? []) {
    if (typeof row?.namespace === 'string') result.set(row.namespace, row.config ?? {});
  }
  return result;
}

function enabled(config, fallback = true) {
  return typeof config?.enabled === 'boolean' ? config.enabled : fallback;
}

function responseMode(config) {
  if (config?.reply_enabled === false || config?.enabled === false) return 'off';
  return RESPONSE_MODES.has(config?.mode) ? config.mode : 'mention_only';
}

function aiDisabledMessage(locale) {
  const language = String(locale ?? 'ru').toLowerCase();
  if (language.startsWith('uk')) return 'Функції ШІ вимкнені для цього Telegram-простору.';
  if (language.startsWith('ru')) return 'Функции ИИ отключены для этого Telegram-пространства.';
  return 'AI functions are disabled for this Telegram workspace.';
}

export function createTelegramWorkspaceRuntimeWiring({ runtime, workspaceRegistry, workspaceStore } = {}) {
  if (!runtime?.handle) throw new TypeError('runtime.handle is required');
  if (!workspaceRegistry?.resolveTelegramChatId) throw new TypeError('workspaceRegistry.resolveTelegramChatId is required');
  if (!workspaceStore?.listConfigs) throw new TypeError('workspaceStore.listConfigs is required');

  async function resolvePolicyByTelegramChatId(telegramChatId) {
    if (telegramChatId == null || telegramChatId === '') return null;
    const workspace = await workspaceRegistry.resolveTelegramChatId(String(telegramChatId));
    if (!workspace) return null;

    const configs = configMap(await workspaceStore.listConfigs({ workspaceId: workspace.workspaceId }));
    const responses = configs.get('responses') ?? {};
    const memory = configs.get('memory') ?? {};
    const ai = configs.get('ai') ?? {};
    const moderation = configs.get('moderation') ?? {};
    const publication = configs.get('publication') ?? {};
    const automation = configs.get('automation') ?? {};
    const notifications = configs.get('notifications') ?? {};
    const members = configs.get('members') ?? {};

    return freeze({
      version: RUNTIME_POLICY_VERSION,
      workspaceId: workspace.workspaceId,
      telegramChatId: String(workspace.telegramChatId),
      responseMode: responseMode(responses),
      workspaceMemoryEnabled: enabled(memory),
      aiEnabled: enabled(ai),
      moderation: { enabled: enabled(moderation), ...moderation },
      publication: { enabled: enabled(publication), ...publication },
      automation: { enabled: enabled(automation), ...automation },
      notifications: { enabled: enabled(notifications), ...notifications },
      members: { enabled: enabled(members), ...members },
      enforcement: {
        responses: 'runtime',
        ai: 'runtime',
        workspaceMemory: 'runtime-context',
        moderation: 'propagation-only',
        publication: 'propagation-only',
        automation: 'propagation-only',
        notifications: 'propagation-only',
        members: 'propagation-only'
      }
    });
  }

  async function evaluateInvocation({ update, baseInvocation }) {
    if (!baseInvocation || typeof baseInvocation.accepted !== 'boolean') throw new TypeError('baseInvocation is required');
    const chat = chatFromUpdate(update);
    const policy = await resolvePolicyByTelegramChatId(chat?.id);
    if (!policy) return baseInvocation;

    if (policy.responseMode === 'off') {
      return freeze({ accepted: false, reason: 'workspace-responses-off', workspaceRuntimePolicy: policy });
    }

    if (
      policy.responseMode === 'all' &&
      baseInvocation.accepted === false &&
      baseInvocation.reason === 'ambient-group-message' &&
      ['group', 'supergroup'].includes(chat?.type)
    ) {
      return freeze({ accepted: true, reason: 'workspace-response-mode-all', workspaceRuntimePolicy: policy });
    }

    return freeze({ ...baseInvocation, workspaceRuntimePolicy: policy });
  }

  async function handle(canonicalInput) {
    const telegramChatId = canonicalInput?.scopeContext?.groupScope ?? null;
    const policy = await resolvePolicyByTelegramChatId(telegramChatId);
    if (!policy) return runtime.handle(canonicalInput);

    if (policy.aiEnabled === false) {
      return freeze({
        status: 'success',
        message: aiDisabledMessage(canonicalInput.locale),
        data: { reason: 'workspace-ai-disabled', workspaceId: policy.workspaceId }
      });
    }

    const decoratedInput = freeze({
      ...canonicalInput,
      metadata: {
        ...(canonicalInput.metadata ?? {}),
        workspaceRuntimePolicy: policy
      }
    });
    return runtime.handle(decoratedInput);
  }

  return freeze({ resolvePolicyByTelegramChatId, evaluateInvocation, handle });
}

export const TELEGRAM_WORKSPACE_RUNTIME_POLICY_VERSION = RUNTIME_POLICY_VERSION;
