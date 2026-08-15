import { captureRecentMedia, getRecentMedia, injectMedia, currentMedia } from './telegramRecentMediaEphemeralContext.js';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function semanticText(update) {
  const message = update?.message ?? update?.edited_message ?? null;
  if (typeof message?.text === 'string' && message.text.trim() !== '') return message.text.trim();
  if (typeof message?.caption === 'string' && message.caption.trim() !== '') return message.caption.trim();
  return '';
}

function bareMedia(update) {
  return Boolean(currentMedia(update)) && semanticText(update) === '';
}

export function createTelegramWorkspaceUnifiedNaturalLanguageService({ configurationNaturalLanguage, operationsNaturalLanguage } = {}) {
  if (typeof configurationNaturalLanguage?.handleUpdate !== 'function' || typeof configurationNaturalLanguage?.routeUpdate !== 'function') throw new TypeError('configurationNaturalLanguage is required');
  if (typeof operationsNaturalLanguage?.handleUpdate !== 'function') throw new TypeError('operationsNaturalLanguage is required');

  async function routeUpdate(update) {
    if (bareMedia(update)) {
      return freeze({
        destination: 'telegram-workspace-manager',
        workspaceOperation: 'capture-media',
        directInvocation: true,
        reason: 'telegram-recent-media-context-capture'
      });
    }
    const recent = getRecentMedia(update);
    return configurationNaturalLanguage.routeUpdate(recent ? injectMedia(update, recent) : update);
  }

  async function handleUpdate(update, options = {}) {
    const callbackData = update?.callback_query?.data;
    if (typeof callbackData === 'string' && callbackData.startsWith('twm19|op-')) return operationsNaturalLanguage.handleUpdate(update, options);
    if (typeof callbackData === 'string' && callbackData.startsWith('twm19|')) return configurationNaturalLanguage.handleUpdate(update, options);

    if (options?.semanticRoute?.workspaceOperation === 'capture-media') {
      const captured = captureRecentMedia(update);
      return freeze({ handled: true, outcome: captured.captured ? 'media-context-captured' : 'media-context-not-captured' });
    }

    if (options?.semanticRoute?.workspaceOperation === 'operate') {
      if (currentMedia(update)) captureRecentMedia(update);
      const recent = currentMedia(update) ? null : getRecentMedia(update);
      const effectiveUpdate = recent ? injectMedia(update, recent) : update;
      return operationsNaturalLanguage.handleUpdate(effectiveUpdate, options);
    }
    return configurationNaturalLanguage.handleUpdate(update, options);
  }

  return freeze({ handleUpdate, routeUpdate });
}
