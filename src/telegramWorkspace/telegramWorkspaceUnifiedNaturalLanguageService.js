function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

export function createTelegramWorkspaceUnifiedNaturalLanguageService({ configurationNaturalLanguage, operationsNaturalLanguage } = {}) {
  if (typeof configurationNaturalLanguage?.handleUpdate !== 'function' || typeof configurationNaturalLanguage?.routeUpdate !== 'function') throw new TypeError('configurationNaturalLanguage is required');
  if (typeof operationsNaturalLanguage?.handleUpdate !== 'function') throw new TypeError('operationsNaturalLanguage is required');

  async function handleUpdate(update, options = {}) {
    const callbackData = update?.callback_query?.data;
    if (typeof callbackData === 'string' && callbackData.startsWith('twmop|')) return operationsNaturalLanguage.handleUpdate(update, options);
    if (typeof callbackData === 'string' && callbackData.startsWith('twm19|')) return configurationNaturalLanguage.handleUpdate(update, options);
    if (options?.semanticRoute?.workspaceOperation === 'operate') return operationsNaturalLanguage.handleUpdate(update, options);
    return configurationNaturalLanguage.handleUpdate(update, options);
  }

  return freeze({
    handleUpdate,
    routeUpdate: (update) => configurationNaturalLanguage.routeUpdate(update)
  });
}
