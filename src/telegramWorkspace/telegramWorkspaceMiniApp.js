import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const DEFAULT_MAX_AGE_SECONDS = 10 * 60;
const MAX_INIT_DATA_BYTES = 16 * 1024;
const MAX_WORKSPACES = 30;
const MAX_CONFIRMATION_TOKEN_BYTES = 48 * 1024;

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function fail(message, code, details = null) {
  const error = new Error(message);
  error.name = 'TelegramWorkspaceMiniAppError';
  error.code = code;
  error.details = details;
  throw error;
}

function safeEqualHex(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseTelegramUser(raw) {
  let user;
  try { user = JSON.parse(raw); } catch { fail('Telegram Mini App user is invalid', 'twm-mini-app-user-invalid'); }
  if (!user || typeof user !== 'object' || Array.isArray(user) || !Number.isSafeInteger(Number(user.id))) {
    fail('Telegram Mini App user id is invalid', 'twm-mini-app-user-invalid');
  }
  return freeze({
    id: String(user.id),
    firstName: typeof user.first_name === 'string' ? user.first_name : null,
    lastName: typeof user.last_name === 'string' ? user.last_name : null,
    username: typeof user.username === 'string' ? user.username : null,
    languageCode: typeof user.language_code === 'string' ? user.language_code : null
  });
}

/**
 * Validates Telegram WebApp initData using Telegram's server-side HMAC scheme.
 * Returned user facts are transport evidence only; SG Identity/Authority remains authoritative.
 * bindingKey is server-internal and must never be returned by a Mini App HTTP response.
 */
export function verifyTelegramMiniAppInitData(initDataValue, botTokenValue, {
  clock = () => new Date(),
  maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS
} = {}) {
  if (typeof initDataValue !== 'string' || initDataValue.trim() === '') fail('Telegram Mini App initData is missing', 'twm-mini-app-init-data-incomplete');
  const initData = initDataValue.trim();
  const botToken = required(botTokenValue, 'botToken');
  if (Buffer.byteLength(initData, 'utf8') > MAX_INIT_DATA_BYTES) fail('Telegram Mini App initData is too large', 'twm-mini-app-init-data-too-large');
  const maxAge = Number(maxAgeSeconds);
  if (!Number.isSafeInteger(maxAge) || maxAge < 30 || maxAge > 3600) throw new TypeError('maxAgeSeconds must be an integer from 30 to 3600');

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  const authDateRaw = params.get('auth_date');
  const userRaw = params.get('user');
  if (!receivedHash || !authDateRaw || !userRaw) fail('Telegram Mini App initData is incomplete', 'twm-mini-app-init-data-incomplete');

  const authDate = Number(authDateRaw);
  if (!Number.isSafeInteger(authDate) || authDate <= 0) fail('Telegram Mini App auth_date is invalid', 'twm-mini-app-auth-date-invalid');
  const nowSeconds = Math.floor(clock().getTime() / 1000);
  const age = nowSeconds - authDate;
  if (age < -30 || age > maxAge) fail('Telegram Mini App initData is expired', 'twm-mini-app-init-data-expired');

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (!safeEqualHex(receivedHash, expectedHash)) fail('Telegram Mini App signature is invalid', 'twm-mini-app-signature-invalid');
  const bindingKey = createHmac('sha256', secretKey).update(`sg:twm1.13:${receivedHash}`).digest('hex');

  return freeze({
    telegramUser: parseTelegramUser(userRaw),
    authDate,
    queryId: params.get('query_id') || null,
    startParam: params.get('start_param') || null,
    bindingKey
  });
}

function signOpaque(body, bindingKey, context) {
  return createHmac('sha256', required(bindingKey, 'bindingKey')).update(`${context}:${body}`).digest('hex');
}

function encodeWorkspaceRef(workspaceId, bindingKey) {
  const body = Buffer.from(required(workspaceId, 'workspaceId'), 'utf8').toString('base64url');
  return `twr_${body}.${signOpaque(body, bindingKey, 'workspace-ref')}`;
}

function decodeWorkspaceRef(value, bindingKey) {
  const ref = required(value, 'workspaceRef');
  if (!ref.startsWith('twr_') || ref.length > 512) fail('Mini App workspace reference is invalid', 'twm-mini-app-workspace-ref-invalid');
  const token = ref.slice(4);
  const separator = token.lastIndexOf('.');
  if (separator < 1) fail('Mini App workspace reference is invalid', 'twm-mini-app-workspace-ref-invalid');
  const body = token.slice(0, separator);
  const received = token.slice(separator + 1);
  const expected = signOpaque(body, bindingKey, 'workspace-ref');
  if (!safeEqualHex(received, expected)) fail('Mini App workspace reference is invalid', 'twm-mini-app-workspace-ref-invalid');
  let workspaceId;
  try { workspaceId = Buffer.from(body, 'base64url').toString('utf8'); } catch { fail('Mini App workspace reference is invalid', 'twm-mini-app-workspace-ref-invalid'); }
  return required(workspaceId, 'workspaceId');
}

function publicWorkspace(workspace, bindingKey) {
  return freeze({
    workspaceRef: encodeWorkspaceRef(workspace.workspaceId, bindingKey),
    workspaceType: workspace.workspaceType,
    title: workspace.title ?? null,
    username: workspace.username ?? null,
    lifecycleState: workspace.lifecycleState,
    botMembershipState: workspace.botMembershipState
  });
}

function proposalPayload(proposal, workspaceRef) {
  return freeze({
    kind: 'twm-mini-app-confirmation-v1',
    proposalId: required(proposal.proposalId, 'proposal.proposalId'),
    requestId: required(proposal.requestId, 'proposal.requestId'),
    workspaceRef: required(workspaceRef, 'workspaceRef'),
    namespace: required(proposal.namespace, 'proposal.namespace'),
    traceId: required(proposal.traceId, 'proposal.traceId'),
    baseVersion: Number(proposal.baseVersion),
    nextConfig: proposal.nextConfig,
    changedPaths: proposal.changedPaths,
    risk: proposal.risk,
    confirmationRequired: proposal.confirmationRequired === true,
    reason: proposal.reason ?? 'telegram-mini-app:confirmed-apply'
  });
}

function encodeConfirmation(payload, bindingKey) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = signOpaque(body, bindingKey, 'proposal-confirmation');
  const token = `${body}.${signature}`;
  if (Buffer.byteLength(token, 'utf8') > MAX_CONFIRMATION_TOKEN_BYTES) fail('Mini App confirmation token is too large', 'twm-mini-app-confirmation-token-too-large');
  return token;
}

function decodeConfirmation(tokenValue, bindingKey) {
  const token = required(tokenValue, 'confirmationToken');
  if (Buffer.byteLength(token, 'utf8') > MAX_CONFIRMATION_TOKEN_BYTES) fail('Mini App confirmation token is too large', 'twm-mini-app-confirmation-token-too-large');
  const separator = token.lastIndexOf('.');
  if (separator < 1) fail('Mini App confirmation token is invalid', 'twm-mini-app-confirmation-token-invalid');
  const body = token.slice(0, separator);
  const receivedSignature = token.slice(separator + 1);
  const expectedSignature = signOpaque(body, bindingKey, 'proposal-confirmation');
  if (!safeEqualHex(receivedSignature, expectedSignature)) fail('Mini App confirmation token signature is invalid', 'twm-mini-app-confirmation-token-invalid');
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { fail('Mini App confirmation token payload is invalid', 'twm-mini-app-confirmation-token-invalid'); }
  if (!payload || typeof payload !== 'object' || payload.kind !== 'twm-mini-app-confirmation-v1') fail('Mini App confirmation token payload is invalid', 'twm-mini-app-confirmation-token-invalid');
  if (!Number.isInteger(payload.baseVersion) || payload.baseVersion < 0) fail('Mini App confirmation token version is invalid', 'twm-mini-app-confirmation-token-invalid');
  return freeze(payload);
}

export function createTelegramWorkspaceMiniAppService({
  verifyInitData,
  identityResolver,
  workspaceRegistry,
  authorityResolver,
  configurationService,
  botCapabilityService = null,
  projectScope = 'sg2.1',
  idFactory = () => randomUUID(),
  audit = async () => {}
} = {}) {
  if (typeof verifyInitData !== 'function') throw new TypeError('verifyInitData is required');
  if (typeof identityResolver !== 'function') throw new TypeError('identityResolver is required');
  if (typeof workspaceRegistry?.listWorkspaces !== 'function') throw new TypeError('workspaceRegistry.listWorkspaces is required');
  if (typeof authorityResolver?.verify !== 'function') throw new TypeError('authorityResolver.verify is required');
  for (const method of ['getConfig', 'listConfigs', 'proposeChange', 'applyProposal', 'history', 'rollback']) {
    if (typeof configurationService?.[method] !== 'function') throw new TypeError(`configurationService.${method} is required`);
  }
  if (botCapabilityService !== null && typeof botCapabilityService?.getHealth !== 'function') throw new TypeError('botCapabilityService.getHealth is required');
  const project = required(projectScope, 'projectScope');

  async function identify(initData) {
    const verified = await verifyInitData(initData);
    const user = verified?.telegramUser;
    if (!user?.id || !verified?.bindingKey) fail('Telegram Mini App identity evidence is missing', 'twm-mini-app-identity-missing');
    const resolution = await identityResolver(Object.freeze({
      transport: 'telegram',
      platformFacts: Object.freeze({
        platform: 'telegram',
        platformUserId: user.id,
        platformChatId: user.id,
        profile: Object.freeze({
          displayName: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || null,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          languageCode: user.languageCode,
          source: 'telegram-mini-app'
        })
      }),
      scopeFacts: Object.freeze({ projectId: project, groupId: null, threadId: null })
    }));
    return freeze({
      telegramUserId: user.id,
      actorGlobalUserId: required(resolution?.identityContext?.globalUserId, 'resolved globalUserId'),
      languageCode: user.languageCode,
      queryId: verified.queryId ?? null,
      bindingKey: verified.bindingKey
    });
  }

  async function requireWorkspace(actor, workspaceId, requestedAction = 'workspace:view', forceFresh = false) {
    const id = required(workspaceId, 'workspaceId');
    const decision = await authorityResolver.verify({
      workspaceId: id,
      telegramUserId: actor.telegramUserId,
      expectedGlobalUserId: actor.actorGlobalUserId,
      requestedAction,
      forceFresh
    });
    if (!decision?.allowed) fail('workspace authority denied', decision?.reason ?? 'twm-mini-app-authority-denied');
    return decision;
  }

  async function authorizedWorkspaces(actor) {
    const candidates = await workspaceRegistry.listWorkspaces({ limit: MAX_WORKSPACES });
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
        if (decision?.allowed) allowed.push(publicWorkspace(workspace, actor.bindingKey));
      } catch {}
    }
    return freeze(allowed);
  }

  async function bootstrap({ initData } = {}) {
    const actor = await identify(initData);
    const workspaces = await authorizedWorkspaces(actor);
    try { await audit(freeze({ eventClass: 'telegram_workspace_mini_app', action: 'bootstrap', outcome: 'success', actorGlobalUserId: actor.actorGlobalUserId, workspaceCount: workspaces.length })); } catch {}
    return freeze({ version: 'twm1.13.v1', workspaces });
  }

  async function workspace({ initData, workspaceRef } = {}) {
    const actor = await identify(initData);
    const workspaceId = decodeWorkspaceRef(workspaceRef, actor.bindingKey);
    await requireWorkspace(actor, workspaceId, 'workspace:view', false);
    const configs = await configurationService.listConfigs({ workspaceId, actorGlobalUserId: actor.actorGlobalUserId, telegramUserId: actor.telegramUserId });
    let capabilityHealth = null;
    if (botCapabilityService) {
      try { capabilityHealth = await botCapabilityService.getHealth({ workspaceId, requireFresh: false }); } catch (error) {
        capabilityHealth = freeze({ available: false, status: 'verification-failed', reason: error?.code ?? 'twm-mini-app-capability-failed' });
      }
    }
    return freeze({ workspaceRef, configs, capabilityHealth });
  }

  async function propose({ initData, workspaceRef, namespace, nextConfig } = {}) {
    const actor = await identify(initData);
    const workspaceId = decodeWorkspaceRef(workspaceRef, actor.bindingKey);
    const requestId = `twm-mini:${idFactory()}`;
    const traceId = `twm-mini:${idFactory()}`;
    const proposal = await configurationService.proposeChange({
      workspaceId,
      namespace,
      nextConfig,
      actorGlobalUserId: actor.actorGlobalUserId,
      telegramUserId: actor.telegramUserId,
      traceId,
      requestId,
      reason: 'telegram-mini-app:preview'
    });
    const payload = proposalPayload(proposal, workspaceRef);
    return freeze({
      confirmationToken: encodeConfirmation(payload, actor.bindingKey),
      requestId,
      workspaceRef,
      namespace: proposal.namespace,
      baseVersion: proposal.baseVersion,
      changedPaths: proposal.changedPaths,
      risk: proposal.risk,
      confirmationRequired: proposal.confirmationRequired
    });
  }

  async function apply({ initData, confirmationToken, confirmed } = {}) {
    if (confirmed !== true) fail('explicit Mini App confirmation is required', 'twm-mini-app-confirmation-required');
    const actor = await identify(initData);
    const payload = decodeConfirmation(confirmationToken, actor.bindingKey);
    const workspaceId = decodeWorkspaceRef(payload.workspaceRef, actor.bindingKey);
    await requireWorkspace(actor, workspaceId, 'workspace:configure', true);
    const proposal = freeze({
      kind: 'telegram-workspace-config-proposal',
      proposalId: required(payload.proposalId, 'proposalId'),
      requestId: required(payload.requestId, 'requestId'),
      workspaceId,
      namespace: required(payload.namespace, 'namespace'),
      actorGlobalUserId: actor.actorGlobalUserId,
      traceId: required(payload.traceId, 'traceId'),
      reason: payload.reason ?? 'telegram-mini-app:confirmed-apply',
      baseVersion: Number(payload.baseVersion),
      nextConfig: payload.nextConfig,
      changedPaths: freeze([...(payload.changedPaths ?? [])]),
      risk: payload.risk,
      confirmationRequired: payload.confirmationRequired === true
    });
    const result = await configurationService.applyProposal({
      proposal,
      actorGlobalUserId: actor.actorGlobalUserId,
      telegramUserId: actor.telegramUserId,
      confirmation: freeze({ confirmed: true, requestId: proposal.requestId })
    });
    try { await audit(freeze({ eventClass: 'telegram_workspace_mini_app', action: 'apply', outcome: 'success', actorGlobalUserId: actor.actorGlobalUserId, workspaceId, namespace: proposal.namespace, version: result.config.version })); } catch {}
    return result;
  }

  async function history({ initData, workspaceRef, namespace, limit = 20 } = {}) {
    const actor = await identify(initData);
    const workspaceId = decodeWorkspaceRef(workspaceRef, actor.bindingKey);
    return configurationService.history({ workspaceId, namespace, actorGlobalUserId: actor.actorGlobalUserId, telegramUserId: actor.telegramUserId, limit: Math.max(1, Math.min(Number(limit) || 20, 100)) });
  }

  async function rollback({ initData, workspaceRef, namespace, targetVersion, requestId, confirmed } = {}) {
    if (confirmed !== true) fail('explicit Mini App confirmation is required', 'twm-mini-app-confirmation-required');
    const actor = await identify(initData);
    const workspaceId = decodeWorkspaceRef(workspaceRef, actor.bindingKey);
    const request = required(requestId, 'requestId');
    const result = await configurationService.rollback({
      workspaceId,
      namespace,
      targetVersion,
      actorGlobalUserId: actor.actorGlobalUserId,
      telegramUserId: actor.telegramUserId,
      traceId: `twm-mini:${idFactory()}`,
      requestId: request,
      reason: 'telegram-mini-app:confirmed-rollback',
      confirmation: freeze({ confirmed: true, requestId: request })
    });
    try { await audit(freeze({ eventClass: 'telegram_workspace_mini_app', action: 'rollback', outcome: 'success', actorGlobalUserId: actor.actorGlobalUserId, workspaceId, namespace, version: result.config.version, targetVersion: Number(targetVersion) })); } catch {}
    return result;
  }

  return Object.freeze({ bootstrap, workspace, propose, apply, history, rollback });
}