import { randomUUID } from 'node:crypto';

const ENTRY_COMMANDS = new Set(['/workspace', '/workspaces', '/sg_workspace', '/sg_workspaces']);
const SIMPLE_PRESETS = Object.freeze({
  'responses:mention': Object.freeze({ namespace: 'responses', label: 'Ответы: только по обращению', config: Object.freeze({ enabled: true, reply_enabled: true, mode: 'mention_only' }) }),
  'responses:all': Object.freeze({ namespace: 'responses', label: 'Ответы: на все сообщения', config: Object.freeze({ enabled: true, reply_enabled: true, mode: 'all' }) }),
  'responses:off': Object.freeze({ namespace: 'responses', label: 'Ответы: выключить', config: Object.freeze({ enabled: false, reply_enabled: false, mode: 'off' }) }),
  'moderation:on': Object.freeze({ namespace: 'moderation', label: 'Модерация: включить базовую защиту', config: Object.freeze({ enabled: true, warning_limit: 2, spam: Object.freeze({ enabled: true }), flood: Object.freeze({ enabled: true }), links: Object.freeze({ enabled: false }) }) }),
  'moderation:off': Object.freeze({ namespace: 'moderation', label: 'Модерация: выключить', config: Object.freeze({ enabled: false }) }),
  'publication:preview': Object.freeze({ namespace: 'publication', label: 'Публикации: предпросмотр включён', config: Object.freeze({ enabled: true, preview_before_publish: true }) }),
  'publication:direct': Object.freeze({ namespace: 'publication', label: 'Публикации: без предпросмотра', config: Object.freeze({ enabled: true, preview_before_publish: false }) }),
  'memory:on': Object.freeze({ namespace: 'memory', label: 'Память: включить', config: Object.freeze({ enabled: true }) }),
  'memory:off': Object.freeze({ namespace: 'memory', label: 'Память: выключить', config: Object.freeze({ enabled: false }) }),
  'ai:on': Object.freeze({ namespace: 'ai', label: 'AI-функции: включить', config: Object.freeze({ enabled: true }) }),
  'ai:off': Object.freeze({ namespace: 'ai', label: 'AI-функции: выключить', config: Object.freeze({ enabled: false }) }),
  'automation:on': Object.freeze({ namespace: 'automation', label: 'Автоматизация: включить', config: Object.freeze({ enabled: true }) }),
  'automation:off': Object.freeze({ namespace: 'automation', label: 'Автоматизация: выключить', config: Object.freeze({ enabled: false }) }),
  'notifications:on': Object.freeze({ namespace: 'notifications', label: 'Уведомления: включить', config: Object.freeze({ enabled: true }) }),
  'notifications:off': Object.freeze({ namespace: 'notifications', label: 'Уведомления: выключить', config: Object.freeze({ enabled: false }) }),
  'members:on': Object.freeze({ namespace: 'members', label: 'Управление ролями: включить', config: Object.freeze({ enabled: true }) }),
  'members:off': Object.freeze({ namespace: 'members', label: 'Управление ролями: выключить', config: Object.freeze({ enabled: false }) })
});

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function callback(parts) {
  const value = ['twm', ...parts].join('|');
  if (Buffer.byteLength(value, 'utf8') > 64) throw new TypeError('Telegram callback_data exceeds 64 bytes');
  return value;
}
function keyboard(rows) { return { inline_keyboard: rows }; }
function button(text, ...parts) { return { text, callback_data: callback(parts) }; }
function parseCallback(data) {
  if (typeof data !== 'string' || !data.startsWith('twm|')) return null;
  return data.split('|').slice(1);
}
function commandFromMessage(message) {
  const text = typeof message?.text === 'string' ? message.text.trim() : '';
  if (!text.startsWith('/')) return null;
  return text.split(/\s+/, 1)[0].split('@', 1)[0].toLowerCase();
}
function workspaceTitle(workspace) {
  return String(workspace.title || workspace.username || `${workspace.workspaceType} ${workspace.telegramChatId}`).slice(0, 42);
}
function actorFacts(update) {
  const source = update?.callback_query?.from ?? update?.message?.from ?? null;
  if (!source?.id) throw new TypeError('Telegram UI actor is required');
  return {
    telegramUserId: String(source.id),
    locale: source.language_code ?? 'ru',
    platformFacts: Object.freeze({
      platform: 'telegram',
      platformUserId: String(source.id),
      platformChatId: String(update?.callback_query?.message?.chat?.id ?? update?.message?.chat?.id ?? source.id),
      profile: Object.freeze({
        displayName: [source.first_name, source.last_name].filter(Boolean).join(' ').trim() || source.username || null,
        firstName: source.first_name ?? null,
        lastName: source.last_name ?? null,
        username: source.username ?? null,
        languageCode: source.language_code ?? null,
        source: 'telegram'
      })
    })
  };
}

export function createTelegramWorkspaceNativeUi({
  botClient,
  identityResolver,
  workspaceRegistry,
  authorityResolver,
  configurationService,
  botCapabilityService = null,
  projectScope = 'sg2.1',
  idFactory = () => randomUUID(),
  audit = async () => {}
} = {}) {
  for (const method of ['sendMessage', 'editMessageText', 'answerCallbackQuery']) if (typeof botClient?.[method] !== 'function') throw new TypeError(`botClient.${method} is required`);
  if (typeof identityResolver !== 'function') throw new TypeError('identityResolver is required');
  if (typeof workspaceRegistry?.listWorkspaces !== 'function') throw new TypeError('workspaceRegistry.listWorkspaces is required');
  if (typeof authorityResolver?.verify !== 'function') throw new TypeError('authorityResolver.verify is required');
  for (const method of ['getConfig', 'listConfigs', 'applyChange', 'history', 'rollback']) if (typeof configurationService?.[method] !== 'function') throw new TypeError(`configurationService.${method} is required`);
  if (botCapabilityService !== null && typeof botCapabilityService?.getHealth !== 'function') throw new TypeError('botCapabilityService.getHealth is required');
  const project = required(projectScope, 'projectScope');

  async function identify(update) {
    const facts = actorFacts(update);
    const resolution = await identityResolver(Object.freeze({
      transport: 'telegram',
      platformFacts: facts.platformFacts,
      scopeFacts: Object.freeze({ projectId: project, groupId: null, threadId: null })
    }));
    return freeze({ ...facts, actorGlobalUserId: required(resolution?.identityContext?.globalUserId, 'resolved globalUserId') });
  }

  async function authorizedWorkspaces(actor) {
    const candidates = await workspaceRegistry.listWorkspaces({ limit: 30 });
    const allowed = [];
    for (const workspace of candidates) {
      try {
        const decision = await authorityResolver.verify({
          workspaceId: workspace.workspaceId,
          telegramUserId: actor.telegramUserId,
          expectedGlobalUserId: actor.actorGlobalUserId,
          requestedAction: 'workspace:view',
          forceFresh: false
        });
        if (decision?.allowed) allowed.push(workspace);
      } catch {}
    }
    return allowed;
  }

  async function sendOrEdit(update, text, replyMarkup) {
    const query = update.callback_query;
    if (query?.message?.chat?.id && query?.message?.message_id) {
      return botClient.editMessageText({ chatId: query.message.chat.id, messageId: query.message.message_id, text, replyMarkup });
    }
    const message = update.message;
    return botClient.sendMessage({ chatId: message.chat.id, text, replyMarkup });
  }

  async function showWorkspaceList(update, actor) {
    const workspaces = await authorizedWorkspaces(actor);
    const rows = workspaces.slice(0, 20).map((workspace) => [button(`⚙️ ${workspaceTitle(workspace)}`, 'w', workspace.workspaceId)]);
    rows.push([button('ℹ️ Как подключить группу/канал', 'connect')]);
    const text = workspaces.length
      ? 'Telegram Workspace Manager\n\nВыбери группу или канал для настройки.'
      : 'Telegram Workspace Manager\n\nДоступных рабочих пространств пока нет. Добавь SG в группу/канал и выдай необходимые права, затем открой это меню снова.';
    await sendOrEdit(update, text, keyboard(rows));
  }

  async function requireWorkspace(actor, workspaceId, requestedAction = 'workspace:view', forceFresh = false) {
    const decision = await authorityResolver.verify({ workspaceId, telegramUserId: actor.telegramUserId, expectedGlobalUserId: actor.actorGlobalUserId, requestedAction, forceFresh });
    if (!decision?.allowed) {
      const error = new Error('workspace authority denied');
      error.code = decision?.reason ?? 'twm-workspace-ui-authority-denied';
      throw error;
    }
    return decision;
  }

  async function showWorkspaceMenu(update, actor, workspaceId) {
    await requireWorkspace(actor, workspaceId);
    const workspace = (await workspaceRegistry.listWorkspaces({ limit: 100 })).find((item) => item.workspaceId === workspaceId);
    const title = workspace ? workspaceTitle(workspace) : workspaceId;
    await sendOrEdit(update, `⚙️ ${title}\n\nБыстрая настройка сверху, расширенные функции ниже.`, keyboard([
      [button('🚀 Быстрая настройка', 'menu', workspaceId, 'setup')],
      [button('💬 Ответы', 'menu', workspaceId, 'responses'), button('🛡 Модерация', 'menu', workspaceId, 'moderation')],
      [button('📣 Публикации', 'menu', workspaceId, 'publication')],
      [button('🧠 Расширенные настройки', 'menu', workspaceId, 'advanced')],
      [button('👥 Участники и роли', 'menu', workspaceId, 'members')],
      [button('📜 История / откат', 'hist', workspaceId), button('🩺 Диагностика', 'diag', workspaceId)],
      [button('⬅️ К списку', 'list')]
    ]));
  }

  function presetRows(workspaceId, keys) {
    return keys.map((key) => [button(SIMPLE_PRESETS[key].label, 'preview', workspaceId, key)]);
  }

  async function showSection(update, actor, workspaceId, section) {
    await requireWorkspace(actor, workspaceId);
    let text = '';
    let rows = [];
    if (section === 'setup') {
      text = '🚀 Быстрая настройка\n\nШаг 1: выбери режим ответов. После этого можно включить модерацию и предпросмотр публикаций.';
      rows = presetRows(workspaceId, ['responses:mention', 'responses:all', 'responses:off']);
      rows.push([button('🛡 Базовая модерация', 'preview', workspaceId, 'moderation:on')]);
      rows.push([button('📣 Публикации с предпросмотром', 'preview', workspaceId, 'publication:preview')]);
    } else if (section === 'responses') {
      text = '💬 Настройки ответов';
      rows = presetRows(workspaceId, ['responses:mention', 'responses:all', 'responses:off']);
    } else if (section === 'moderation') {
      text = '🛡 Модерация';
      rows = presetRows(workspaceId, ['moderation:on', 'moderation:off']);
    } else if (section === 'publication') {
      text = '📣 Публикации / канал';
      rows = presetRows(workspaceId, ['publication:preview', 'publication:direct']);
    } else if (section === 'advanced') {
      text = '🧠 Расширенные настройки\n\nОткрывай только нужный раздел.';
      rows = [
        [button('🧠 Память', 'menu', workspaceId, 'memory'), button('🤖 AI', 'menu', workspaceId, 'ai')],
        [button('⏱ Автоматизация', 'menu', workspaceId, 'automation')],
        [button('🔔 Уведомления', 'menu', workspaceId, 'notifications')]
      ];
    } else if (['memory', 'ai', 'automation', 'notifications', 'members'].includes(section)) {
      const labels = { memory: '🧠 Память', ai: '🤖 AI', automation: '⏱ Автоматизация', notifications: '🔔 Уведомления', members: '👥 Участники и роли' };
      text = labels[section];
      rows = presetRows(workspaceId, [`${section}:on`, `${section}:off`]);
    } else {
      throw Object.assign(new Error('unknown TWM UI section'), { code: 'twm-ui-section-unknown' });
    }
    rows.push([button('⬅️ Назад', 'w', workspaceId)]);
    await sendOrEdit(update, text, keyboard(rows));
  }

  async function showPreview(update, actor, workspaceId, presetKey) {
    await requireWorkspace(actor, workspaceId, 'workspace:configure', true);
    const preset = SIMPLE_PRESETS[presetKey];
    if (!preset) throw Object.assign(new Error('unknown TWM preset'), { code: 'twm-ui-preset-unknown' });
    const current = await configurationService.getConfig({ workspaceId, namespace: preset.namespace, actorGlobalUserId: actor.actorGlobalUserId, telegramUserId: actor.telegramUserId });
    const text = `Подтвердить изменение?\n\n${preset.label}\nТекущая версия: ${current.version}`;
    await sendOrEdit(update, text, keyboard([
      [button('✅ Подтвердить', 'apply', workspaceId, presetKey)],
      [button('❌ Отмена', 'w', workspaceId)]
    ]));
  }

  async function applyPreset(update, actor, workspaceId, presetKey) {
    const preset = SIMPLE_PRESETS[presetKey];
    if (!preset) throw Object.assign(new Error('unknown TWM preset'), { code: 'twm-ui-preset-unknown' });
    const requestId = `twm-ui:${update.callback_query.id}`;
    const traceId = `twm-ui:${idFactory()}`;
    const applied = await configurationService.applyChange({
      workspaceId,
      namespace: preset.namespace,
      nextConfig: preset.config,
      actorGlobalUserId: actor.actorGlobalUserId,
      telegramUserId: actor.telegramUserId,
      traceId,
      requestId,
      reason: `telegram-native-ui:${presetKey}`,
      confirmation: Object.freeze({ confirmed: true, requestId })
    });
    await sendOrEdit(update, `✅ Сохранено\n\n${preset.label}\nВерсия: ${applied.config.version}`, keyboard([[button('⬅️ К настройкам', 'w', workspaceId)]]));
  }

  async function showHistory(update, actor, workspaceId) {
    await requireWorkspace(actor, workspaceId);
    const configs = await configurationService.listConfigs({ workspaceId, actorGlobalUserId: actor.actorGlobalUserId, telegramUserId: actor.telegramUserId });
    const rows = configs.slice(0, 12).map((row) => [button(`${row.namespace} · v${row.version}`, 'hns', workspaceId, row.namespace)]);
    rows.push([button('⬅️ Назад', 'w', workspaceId)]);
    await sendOrEdit(update, configs.length ? '📜 История конфигурации\n\nВыбери раздел.' : '📜 История пока пуста.', keyboard(rows));
  }

  async function showNamespaceHistory(update, actor, workspaceId, namespace) {
    await requireWorkspace(actor, workspaceId);
    const rows = await configurationService.history({ workspaceId, namespace, actorGlobalUserId: actor.actorGlobalUserId, telegramUserId: actor.telegramUserId, limit: 8 });
    const buttons = rows.slice(0, 6).map((row) => [button(`↩️ Откатить к v${row.version}`, 'rbp', workspaceId, namespace, String(row.version))]);
    buttons.push([button('⬅️ К истории', 'hist', workspaceId)]);
    await sendOrEdit(update, rows.length ? `📜 ${namespace}\n\nДоступные версии: ${rows.map((row) => `v${row.version}`).join(', ')}` : `📜 ${namespace}: история пуста`, keyboard(buttons));
  }

  async function showRollbackPreview(update, actor, workspaceId, namespace, version) {
    await requireWorkspace(actor, workspaceId, 'workspace:configure', true);
    await sendOrEdit(update, `Подтвердить откат ${namespace} к версии ${version}?\n\nОткат создаст новую версию и сохранит историю.`, keyboard([
      [button('✅ Подтвердить откат', 'rba', workspaceId, namespace, version)],
      [button('❌ Отмена', 'hns', workspaceId, namespace)]
    ]));
  }

  async function applyRollback(update, actor, workspaceId, namespace, version) {
    const requestId = `twm-ui:${update.callback_query.id}`;
    const traceId = `twm-ui:${idFactory()}`;
    const result = await configurationService.rollback({
      workspaceId,
      namespace,
      targetVersion: Number(version),
      actorGlobalUserId: actor.actorGlobalUserId,
      telegramUserId: actor.telegramUserId,
      traceId,
      requestId,
      reason: 'telegram-native-ui:rollback',
      confirmation: Object.freeze({ confirmed: true, requestId })
    });
    await sendOrEdit(update, `✅ Откат выполнен\n\n${namespace}: новая версия ${result.config.version}, восстановлена v${result.rolledBackToVersion}.`, keyboard([[button('⬅️ К истории', 'hist', workspaceId)]]));
  }

  async function showDiagnostics(update, actor, workspaceId) {
    const authority = await requireWorkspace(actor, workspaceId, 'workspace:view', true);
    let capabilityText = 'Проверка прав бота недоступна.';
    if (botCapabilityService) {
      const health = await botCapabilityService.getHealth({ workspaceId, requireFresh: true });
      capabilityText = `Бот: ${health.available ? 'готов' : 'ограничен'}\nСостояние: ${health.status ?? health.reason ?? 'unknown'}${health.missingPermissions?.length ? `\nНе хватает: ${health.missingPermissions.join(', ')}` : ''}`;
    }
    await sendOrEdit(update, `🩺 Диагностика\n\nДоступ пользователя: ${authority.workspaceRole ?? 'authorized'}\n${capabilityText}`, keyboard([[button('⬅️ Назад', 'w', workspaceId)]]));
  }

  async function showConnect(update) {
    await sendOrEdit(update, 'Как подключить SG:\n\n1. Добавь бота SG в группу, супергруппу или канал.\n2. Для канала/модерации выдай боту только нужные Telegram-права.\n3. Убедись, что твоя учётная запись является creator/admin этой группы или канала.\n4. Напиши /workspaces в личном чате с SG.\n\nSG сам обнаружит workspace и проверит права.', keyboard([[button('⬅️ К списку', 'list')]]));
  }

  async function handleUpdate(update) {
    const command = commandFromMessage(update?.message);
    const queryParts = parseCallback(update?.callback_query?.data);
    if (!ENTRY_COMMANDS.has(command) && !queryParts) return Object.freeze({ handled: false });
    if (command && update?.message?.chat?.type !== 'private') return Object.freeze({ handled: false });

    const actor = await identify(update);
    try {
      if (command || queryParts?.[0] === 'list') await showWorkspaceList(update, actor);
      else if (queryParts[0] === 'connect') await showConnect(update);
      else if (queryParts[0] === 'w') await showWorkspaceMenu(update, actor, queryParts[1]);
      else if (queryParts[0] === 'menu') await showSection(update, actor, queryParts[1], queryParts[2]);
      else if (queryParts[0] === 'preview') await showPreview(update, actor, queryParts[1], queryParts.slice(2).join('|'));
      else if (queryParts[0] === 'apply') await applyPreset(update, actor, queryParts[1], queryParts.slice(2).join('|'));
      else if (queryParts[0] === 'hist') await showHistory(update, actor, queryParts[1]);
      else if (queryParts[0] === 'hns') await showNamespaceHistory(update, actor, queryParts[1], queryParts[2]);
      else if (queryParts[0] === 'rbp') await showRollbackPreview(update, actor, queryParts[1], queryParts[2], queryParts[3]);
      else if (queryParts[0] === 'rba') await applyRollback(update, actor, queryParts[1], queryParts[2], queryParts[3]);
      else if (queryParts[0] === 'diag') await showDiagnostics(update, actor, queryParts[1]);
      else throw Object.assign(new Error('unsupported TWM callback'), { code: 'twm-ui-callback-unsupported' });

      if (update?.callback_query?.id) await botClient.answerCallbackQuery({ callbackQueryId: update.callback_query.id });
      try { await audit(freeze({ eventClass: 'telegram_workspace_native_ui', outcome: 'success', actorGlobalUserId: actor.actorGlobalUserId, action: command ?? queryParts?.[0] ?? 'unknown' })); } catch {}
      return Object.freeze({ handled: true, ok: true });
    } catch (error) {
      if (update?.callback_query?.id) {
        try { await botClient.answerCallbackQuery({ callbackQueryId: update.callback_query.id, text: 'Операция недоступна или права изменились.', showAlert: true }); } catch {}
      }
      try { await audit(freeze({ eventClass: 'telegram_workspace_native_ui', outcome: 'failure', actorGlobalUserId: actor.actorGlobalUserId, action: command ?? queryParts?.[0] ?? 'unknown', reason: error?.code ?? 'twm-ui-failed' })); } catch {}
      throw error;
    }
  }

  return Object.freeze({ handleUpdate, presets: SIMPLE_PRESETS });
}
