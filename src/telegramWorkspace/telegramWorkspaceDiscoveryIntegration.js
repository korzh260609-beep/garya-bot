import { extractTelegramWorkspaceEvents } from './telegramWorkspaceDiscovery.js';

export function createTelegramWorkspaceDiscoveryIntegration({ registry } = {}) {
  if (!registry || typeof registry.applyAll !== 'function') throw new TypeError('workspace registry.applyAll is required');

  async function ingest(update) {
    const events = extractTelegramWorkspaceEvents(update);
    if (events.length === 0) return Object.freeze({ discovered: false, events: Object.freeze([]), workspaces: Object.freeze([]) });
    const workspaces = await registry.applyAll(events);
    return Object.freeze({ discovered: true, events, workspaces });
  }

  return Object.freeze({ ingest });
}

export function createTelegramWorkspaceDiscoveryUpdateStore({ updateStore, discovery } = {}) {
  if (!updateStore || typeof updateStore.claim !== 'function' || typeof updateStore.complete !== 'function' || typeof updateStore.fail !== 'function') throw new TypeError('Telegram update store is required');
  if (!discovery || typeof discovery.ingest !== 'function') throw new TypeError('workspace discovery integration is required');

  return Object.freeze({
    async claim(update) {
      // Discovery intentionally runs before the existing dedupe claim. Its registry writes are idempotent,
      // so replay can repair a prior partial discovery failure without creating duplicate workspace roots.
      await discovery.ingest(update);
      return updateStore.claim(update);
    },
    complete: (updateId, status) => updateStore.complete(updateId, status),
    fail: (updateId, failureCode) => updateStore.fail(updateId, failureCode)
  });
}
