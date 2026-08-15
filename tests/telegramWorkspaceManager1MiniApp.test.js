import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  verifyTelegramMiniAppInitData,
  createTelegramWorkspaceMiniAppService,
  createTelegramWorkspaceMiniAppHttpHandler
} from '../src/telegramWorkspace/index.js';

const botToken = '123456:test-token';
const actorGlobalUserId = 'usr_twm113_owner';
const telegramUserId = '113001';
const workspaceId = 'tgw_mini_1';
const deniedWorkspaceId = 'tgw_mini_2';
const now = new Date('2026-08-15T04:00:00.000Z');

function signedInitData({ userId = telegramUserId, authDate = Math.floor(now.getTime() / 1000), token = botToken } = {}) {
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('query_id', 'AAH-mini-query');
  params.set('user', JSON.stringify({ id: Number(userId), first_name: 'Owner', username: 'owner', language_code: 'ru' }));
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}

function fixture() {
  const proposed = [];
  const applied = [];
  const rollbacks = [];
  const identityResolver = async ({ platformFacts }) => {
    assert.equal(platformFacts.platform, 'telegram');
    assert.equal(platformFacts.platformUserId, telegramUserId);
    return Object.freeze({ identityContext: Object.freeze({ globalUserId: actorGlobalUserId }) });
  };
  const workspaceRegistry = Object.freeze({
    async listWorkspaces() {
      return Object.freeze([
        Object.freeze({ workspaceId, workspaceType: 'supergroup', title: 'Sandbox', lifecycleState: 'ACTIVE', botMembershipState: 'MEMBER' }),
        Object.freeze({ workspaceId: deniedWorkspaceId, workspaceType: 'channel', title: 'Denied', lifecycleState: 'ACTIVE', botMembershipState: 'MEMBER' })
      ]);
    }
  });
  const authorityResolver = Object.freeze({
    async verify(input) {
      assert.equal(input.expectedGlobalUserId, actorGlobalUserId);
      assert.equal(input.telegramUserId, telegramUserId);
      const allowed = input.workspaceId === workspaceId;
      return Object.freeze({ allowed, reason: allowed ? 'verified' : 'twm-authority-denied', workspaceRole: allowed ? 'OWNER' : null });
    }
  });
  const configRow = Object.freeze({ workspaceId, namespace: 'responses', config: Object.freeze({ enabled: true, reply_enabled: true, mode: 'mention_only' }), version: 3 });
  const configurationService = Object.freeze({
    async getConfig() { return configRow; },
    async listConfigs({ workspaceId: wid }) { return wid === workspaceId ? Object.freeze([configRow]) : Object.freeze([]); },
    async proposeChange(input) {
      proposed.push(structuredClone(input));
      return Object.freeze({
        kind: 'telegram-workspace-config-proposal', proposalId: 'proposal-1', requestId: input.requestId,
        workspaceId: input.workspaceId, namespace: input.namespace, actorGlobalUserId: input.actorGlobalUserId,
        traceId: input.traceId, reason: input.reason, baseVersion: 3, nextConfig: Object.freeze(structuredClone(input.nextConfig)),
        changedPaths: Object.freeze(['mode']), risk: 'low', confirmationRequired: false
      });
    },
    async applyProposal(input) {
      applied.push(structuredClone(input));
      return Object.freeze({ config: Object.freeze({ ...configRow, config: Object.freeze(structuredClone(input.proposal.nextConfig)), version: 4 }), actionGate: Object.freeze({ outcome: 'allow' }) });
    },
    async history() { return Object.freeze([Object.freeze({ version: 3 }), Object.freeze({ version: 2 })]); },
    async rollback(input) { rollbacks.push(structuredClone(input)); return Object.freeze({ config: Object.freeze({ version: 4 }), rolledBackToVersion: Number(input.targetVersion) }); }
  });
  const service = createTelegramWorkspaceMiniAppService({
    verifyInitData: (value) => verifyTelegramMiniAppInitData(value, botToken, { clock: () => now }),
    identityResolver,
    workspaceRegistry,
    authorityResolver,
    configurationService,
    projectScope: 'sg2.1',
    idFactory: (() => { let n = 0; return () => `fixed-${++n}`; })()
  });
  return { service, proposed, applied, rollbacks };
}

function responseFixture() {
  const headers = {};
  return {
    response: {
      statusCode: 0,
      setHeader(name, value) { headers[name.toLowerCase()] = value; },
      end(value = '') { this.body = value; }
    },
    headers
  };
}

function request({ url, body = {}, initData = signedInitData(), method = 'POST' }) {
  const req = Readable.from(method === 'POST' ? [Buffer.from(JSON.stringify(body))] : []);
  req.url = url;
  req.method = method;
  req.headers = initData == null ? {} : { 'x-telegram-init-data': initData };
  return req;
}

test('TWM1.13 validates Telegram Mini App initData server-side and rejects tampering/expiry', () => {
  const valid = verifyTelegramMiniAppInitData(signedInitData(), botToken, { clock: () => now });
  assert.equal(valid.telegramUser.id, telegramUserId);
  assert.equal(valid.queryId, 'AAH-mini-query');
  assert.equal(typeof valid.bindingKey, 'string');
  assert.equal(valid.bindingKey.length, 64);

  const tampered = new URLSearchParams(signedInitData());
  tampered.set('user', JSON.stringify({ id: 999999, first_name: 'Attacker' }));
  assert.throws(() => verifyTelegramMiniAppInitData(tampered.toString(), botToken, { clock: () => now }), (error) => error.code === 'twm-mini-app-signature-invalid');

  assert.throws(
    () => verifyTelegramMiniAppInitData(signedInitData({ authDate: Math.floor(now.getTime() / 1000) - 601 }), botToken, { clock: () => now, maxAgeSeconds: 600 }),
    (error) => error.code === 'twm-mini-app-init-data-expired'
  );
});

test('TWM1.13 bootstrap exposes only authority-filtered workspaces and no SG identity or server binding metadata', async () => {
  const fx = fixture();
  const result = await fx.service.bootstrap({ initData: signedInitData() });
  assert.equal(result.version, 'twm1.13.v1');
  assert.equal(result.workspaces.length, 1);
  assert.equal(result.workspaces[0].workspaceId, workspaceId);
  assert.equal(JSON.stringify(result).includes(actorGlobalUserId), false);
  assert.equal(JSON.stringify(result).includes(deniedWorkspaceId), false);
  assert.equal(JSON.stringify(result).includes('bindingKey'), false);
});

test('TWM1.13 preview does not mutate; apply uses the exact server-signed proposal and existing Action Gate boundary', async () => {
  const fx = fixture();
  const nextConfig = { enabled: true, reply_enabled: true, mode: 'all' };
  const preview = await fx.service.propose({ initData: signedInitData(), workspaceId, namespace: 'responses', nextConfig });
  assert.equal(fx.applied.length, 0);
  assert.equal(fx.proposed.length, 1);
  assert.equal(preview.baseVersion, 3);
  assert.match(preview.requestId, /^twm-mini:/);
  assert.equal(typeof preview.confirmationToken, 'string');

  await assert.rejects(
    () => fx.service.apply({ initData: signedInitData(), confirmationToken: preview.confirmationToken, confirmed: false }),
    (error) => error.code === 'twm-mini-app-confirmation-required'
  );
  assert.equal(fx.applied.length, 0);

  await fx.service.apply({ initData: signedInitData(), confirmationToken: preview.confirmationToken, confirmed: true });
  assert.equal(fx.applied.length, 1);
  assert.equal(fx.applied[0].proposal.actorGlobalUserId, actorGlobalUserId);
  assert.equal(fx.applied[0].telegramUserId, telegramUserId);
  assert.deepEqual(fx.applied[0].proposal.nextConfig, nextConfig);
  assert.deepEqual(fx.applied[0].confirmation, { confirmed: true, requestId: preview.requestId });
});

test('TWM1.13 confirmation token cannot be altered into a different configuration', async () => {
  const fx = fixture();
  const preview = await fx.service.propose({ initData: signedInitData(), workspaceId, namespace: 'responses', nextConfig: { enabled: true, reply_enabled: true, mode: 'all' } });
  const [body, signature] = preview.confirmationToken.split('.');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  payload.nextConfig.mode = 'off';
  const forgedBody = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

  await assert.rejects(
    () => fx.service.apply({ initData: signedInitData(), confirmationToken: `${forgedBody}.${signature}`, confirmed: true }),
    (error) => error.code === 'twm-mini-app-confirmation-token-invalid'
  );
  assert.equal(fx.applied.length, 0);
});

test('TWM1.13 confirmation token is session-bound and cannot be reused with different signed Telegram initData', async () => {
  const fx = fixture();
  const preview = await fx.service.propose({ initData: signedInitData(), workspaceId, namespace: 'responses', nextConfig: { enabled: true, reply_enabled: true, mode: 'all' } });
  const differentSession = signedInitData({ authDate: Math.floor(now.getTime() / 1000) - 1 });

  await assert.rejects(
    () => fx.service.apply({ initData: differentSession, confirmationToken: preview.confirmationToken, confirmed: true }),
    (error) => error.code === 'twm-mini-app-confirmation-token-invalid'
  );
  assert.equal(fx.applied.length, 0);
});

test('TWM1.13 cross-workspace access fails at Resource Authority before configuration reads/writes', async () => {
  const fx = fixture();
  await assert.rejects(
    () => fx.service.workspace({ initData: signedInitData(), workspaceId: deniedWorkspaceId }),
    (error) => error.code === 'twm-authority-denied'
  );
  assert.equal(fx.applied.length, 0);
});

test('TWM1.13 HTTP adapter serves UI independently and fails closed without signed Telegram initData', async () => {
  const fx = fixture();
  const handler = createTelegramWorkspaceMiniAppHttpHandler({ service: fx.service });

  const page = responseFixture();
  assert.equal(await handler(request({ url: '/telegram/mini-app', method: 'GET', initData: null }), page.response), true);
  assert.equal(page.response.statusCode, 200);
  assert.match(page.response.body, /Telegram Workspace Manager/);
  assert.match(page.response.body, /confirmationToken/);
  assert.match(page.headers['content-security-policy'], /telegram\.org/);

  const denied = responseFixture();
  assert.equal(await handler(request({ url: '/telegram/mini-app/api/bootstrap', initData: null }), denied.response), true);
  assert.equal(denied.response.statusCode, 401);
  assert.equal(JSON.parse(denied.response.body).ok, false);

  const unrelated = responseFixture();
  assert.equal(await handler(request({ url: '/webhooks/telegram', initData: null }), unrelated.response), false);
});
