import { verifyTelegramMiniAppInitData } from './telegramWorkspaceMiniApp.js';

export const TELEGRAM_MINI_APP_CREDENTIAL_CONNECTION_ID = 'telegram';

export function createTelegramMiniAppInitDataCredentialVerifier({
  credentialManager,
  credentialAccessContext,
  credentialId,
  verifier = verifyTelegramMiniAppInitData
} = {}) {
  if (!credentialManager?.useCredential) throw new TypeError('credentialManager.useCredential is required');
  if (!credentialAccessContext?.actor || !credentialAccessContext?.scope) throw new TypeError('credentialAccessContext actor/scope are required');
  if (typeof credentialId !== 'string' || credentialId.trim() === '') throw new TypeError('credentialId is required');
  if (typeof verifier !== 'function') throw new TypeError('verifier must be a function');

  return (initData) => credentialManager.useCredential({
    credentialId,
    actor: credentialAccessContext.actor,
    scope: credentialAccessContext.scope,
    purpose: 'telegram.mini-app.verify-init-data',
    connectionId: TELEGRAM_MINI_APP_CREDENTIAL_CONNECTION_ID,
    operation: (botToken) => verifier(initData, botToken)
  });
}
