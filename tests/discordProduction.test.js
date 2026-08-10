import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDiscordConfig, DEFAULT_DISCORD_GATEWAY_INTENTS } from '../src/discord/discordConfig.js';
import { createDiscordRestClient } from '../src/discord/discordRestClient.js';
import { createDiscordGatewayClient } from '../src/discord/discordGatewayClient.js';
import { createDiscordProductionIntegration, createInMemoryDiscordEventStore, evaluateDiscordInvocation } from '../src/discord/discordProductionIntegration.js';
import { createDiscordDeliveryTransport } from '../src/delivery/discordDeliveryTransport.js';
import { createProductionDiscordIdentityResolver } from '../src/identity/productionDiscordIdentityResolver.js';

const BOT_ID = '1536265430883242034';
const MONARCH_DISCORD_ID = '1080415346579738684';
const MONARCH_GLOBAL_ID = 'usr_48cc07c069030fb3';
const GUILD_ID = '1536277203036414083';
const CHANNEL_ID = '1536277203505905706';

function validIdentity(globalUserId = MONARCH_GLOBAL_ID, roles = ['monarch']) {
  return {
    identityContext: { globalUserId, platform: 'discord', platformUserId: MONARCH_DISCORD_ID, linkStatus: 'linked', roles, grants: ['capability:compose-answer'], authenticationLevel: 'discord-gateway' },
    scopeContext: { userScope: globalUserId, projectScope: 'sg2.1', groupScope: GUILD_ID, threadScope: CHANNEL_ID, allowedCapabilities: ['compose-answer'] }
  };
}

function message(overrides = {}) {
  return {
    id: '1536279999999999999',
    content: 'hello SG',
    channel_id: CHANNEL_ID,
    guild_id: GUILD_ID,
    author: { id: MONARCH_DISCORD_ID, username: 'garik', bot: false },
    mentions: [{ id: BOT_ID }],
    ...overrides
  };
}

test('Discord config is disabled by default and validates enabled deployment', () => {
  const disabled = loadDiscordConfig({});
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.gatewayIntents, DEFAULT_DISCORD_GATEWAY_INTENTS);
  assert.throws(() => loadDiscordConfig({ SG_DISCORD_ENABLED: 'true', DISCORD_APPLICATION_ID: BOT_ID }), /DISCORD_BOT_TOKEN/);
  const enabled = loadDiscordConfig({ SG_DISCORD_ENABLED: 'true', DISCORD_BOT_TOKEN: 'secret-value', DISCORD_APPLICATION_ID: BOT_ID });
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.applicationId, BOT_ID);
  assert.equal(enabled.botUserId, BOT_ID);
});

test('Discord invocation accepts DM, mention and reply but ignores ambient guild traffic and bots', () => {
  assert.equal(evaluateDiscordInvocation(message({ guild_id: null, mentions: [] }), { botUserId: BOT_ID }).accepted, true);
  assert.equal(evaluateDiscordInvocation(message(), { botUserId: BOT_ID }).reason, 'mention');
  assert.equal(evaluateDiscordInvocation(message({ mentions: [], referenced_message: { author: { id: BOT_ID } } }), { botUserId: BOT_ID }).reason, 'reply-to-bot');
  assert.equal(evaluateDiscordInvocation(message({ mentions: [] }), { botUserId: BOT_ID }).accepted, false);
  assert.equal(evaluateDiscordInvocation(message({ author: { id: BOT_ID, bot: true } }), { botUserId: BOT_ID }).reason, 'bot-message');
});

test('Discord REST client uses Credential Manager and retries rate limits without exposing token', async () => {
  const calls = [];
  const credentialManager = {
    async useCredential({ operation }) { return operation('super-secret-token'); }
  };
  const connectionRegistry = { async requireUsable() { return true; } };
  let attempt = 0;
  const fetchImpl = async (url, options) => {
    attempt += 1;
    calls.push({ url, authorization: options.headers.authorization, body: options.body });
    if (attempt === 1) return new Response(JSON.stringify({ message: 'rate limited', retry_after: 0.001 }), { status: 429, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ id: '1536280000000000000', channel_id: CHANNEL_ID }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const client = createDiscordRestClient({
    credentialManager,
    credentialAccessContext: { actor: { globalUserId: 'system:runtime' }, scope: { projectScope: 'sg2.1' } },
    connectionRegistry,
    connectionAccessContext: { actor: { globalUserId: 'system:runtime' }, projectScope: 'sg2.1' },
    fetchImpl,
    maxRetries: 1,
    sleep: async () => {}
  });
  const result = await client.sendMessage({ channelId: CHANNEL_ID, text: 'reply' });
  assert.equal(result.id, '1536280000000000000');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].authorization, 'Bot super-secret-token');
  assert.equal(JSON.stringify(result).includes('super-secret-token'), false);
});

test('Discord delivery transport delegates to REST client', async () => {
  const sent = [];
  const transport = createDiscordDeliveryTransport({ restClient: { async sendMessage(payload) { sent.push(payload); return { id: '1536280000000000001', channel_id: payload.channelId }; } } });
  const result = await transport.deliver({ request: { message: 'hello', metadata: {} }, target: { address: CHANNEL_ID, replyToMessageId: '1536279999999999999' } });
  assert.equal(sent[0].channelId, CHANNEL_ID);
  assert.equal(result.provider, 'discord');
});

test('Discord production integration executes one canonical SG request and deduplicates repeated message', async () => {
  const delivered = [];
  const canonicalInputs = [];
  const eventStore = createInMemoryDiscordEventStore();
  const integration = createDiscordProductionIntegration({
    restClient: { async sendMessage(payload) { delivered.push(payload); return { id: '1536280000000000002', channel_id: payload.channelId }; } },
    eventStore,
    identityResolver: async () => validIdentity(),
    runtime: { async handle(input) { canonicalInputs.push(input); return { status: 'success', message: 'SG response' }; } },
    botUserId: BOT_ID,
    environment: 'test',
    revision: 'block-8.1',
    idFactory: (() => { let i = 0; return () => `discord-test-${++i}`; })()
  });

  const first = await integration.handleDispatch({ type: 'MESSAGE_CREATE', data: message() });
  const second = await integration.handleDispatch({ type: 'MESSAGE_CREATE', data: message() });
  assert.equal(first.accepted, true);
  assert.equal(second.duplicate, true);
  await integration.drainPending();
  assert.equal(canonicalInputs.length, 1);
  assert.equal(canonicalInputs[0].metadata.transport, 'discord');
  assert.equal(canonicalInputs[0].scopeContext.groupScope, GUILD_ID);
  assert.equal(canonicalInputs[0].scopeContext.threadScope, CHANNEL_ID);
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].channelId, CHANNEL_ID);
});

test('ambient guild message is durably ignored before runtime execution', async () => {
  let executions = 0;
  const integration = createDiscordProductionIntegration({
    restClient: { async sendMessage() { throw new Error('should not deliver'); } },
    eventStore: createInMemoryDiscordEventStore(),
    identityResolver: async () => validIdentity(),
    runtime: { async handle() { executions += 1; return { status: 'success', message: 'no' }; } },
    botUserId: BOT_ID
  });
  const result = await integration.handleDispatch({ type: 'MESSAGE_CREATE', data: message({ mentions: [] }) });
  assert.equal(result.ignored, true);
  assert.equal(executions, 0);
});

function createIdentityPersistenceFixture() {
  const links = new Map();
  const users = new Map();
  const roles = new Map();
  const grants = new Map();
  const key = (user, project) => `${user}|${project}`;
  return {
    links, users,
    repositories: {
      identities: {
        async resolve(platform, platformUserId) { return links.get(`${platform}:${platformUserId}`) ?? null; },
        async link({ platform, platformUserId, globalUserId }) { const row = { platform, platform_user_id: platformUserId, global_user_id: globalUserId }; links.set(`${platform}:${platformUserId}`, row); return row; }
      },
      users: {
        async get(id) { return users.get(id) ?? null; },
        async upsert({ globalUserId, profile }) { const row = { global_user_id: globalUserId, profile }; users.set(globalUserId, row); return row; }
      },
      access: {
        async list({ globalUserId, projectScope }) { return { roles: [...(roles.get(key(globalUserId, projectScope)) ?? [])], grants: [...(grants.get(key(globalUserId, projectScope)) ?? [])].map((grant_name) => ({ grant_name })) }; },
        async grantRole({ globalUserId, projectScope, role }) { const k = key(globalUserId, projectScope); const set = roles.get(k) ?? new Set(); set.add(role); roles.set(k, set); },
        async grantPermission({ globalUserId, projectScope, grantName }) { const k = key(globalUserId, projectScope); const set = grants.get(k) ?? new Set(); set.add(grantName); grants.set(k, set); }
      }
    }
  };
}

test('Discord verified Monarch account resolves to existing canonical Global ID while similar users remain guests', async () => {
  const persistence = createIdentityPersistenceFixture();
  const resolver = createProductionDiscordIdentityResolver({ persistence, projectScope: 'sg2.1', monarchDiscordUserId: MONARCH_DISCORD_ID, monarchGlobalUserId: MONARCH_GLOBAL_ID });
  const monarch = await resolver({ platformFacts: { platform: 'discord', platformUserId: MONARCH_DISCORD_ID, profile: { displayName: 'garik' } }, scopeFacts: { projectId: 'sg2.1', groupId: GUILD_ID, threadId: CHANNEL_ID } });
  assert.equal(monarch.identityContext.globalUserId, MONARCH_GLOBAL_ID);
  assert.ok(monarch.identityContext.roles.includes('monarch'));

  const impostor = await resolver({ platformFacts: { platform: 'discord', platformUserId: '1080415346579738999', profile: { displayName: 'garik', username: 'monarch' } }, scopeFacts: { projectId: 'sg2.1', groupId: GUILD_ID, threadId: CHANNEL_ID } });
  assert.notEqual(impostor.identityContext.globalUserId, MONARCH_GLOBAL_ID);
  assert.equal(impostor.identityContext.roles.includes('monarch'), false);
  assert.ok(impostor.identityContext.roles.includes('guest'));
});

test('Discord Gateway identifies, becomes ready, and shuts down cleanly', async () => {
  class FakeWebSocket {
    constructor() { this.readyState = 1; this.listeners = new Map(); this.sent = []; this.closed = false; }
    addEventListener(name, handler) { const list = this.listeners.get(name) ?? []; list.push(handler); this.listeners.set(name, list); }
    emit(name, data) { for (const handler of this.listeners.get(name) ?? []) handler(data); }
    send(payload) { this.sent.push(JSON.parse(payload)); }
    close(code, reason) { this.closed = true; this.readyState = 3; this.closeCode = code; this.closeReason = reason; }
  }
  const ws = new FakeWebSocket();
  const credentialManager = { async useCredential({ operation }) { return operation('gateway-secret'); } };
  const client = createDiscordGatewayClient({
    restClient: { async getGatewayBot() { return { url: 'wss://gateway.discord.gg' }; } },
    credentialManager,
    credentialAccessContext: { actor: { globalUserId: 'system:runtime' }, scope: { projectScope: 'sg2.1' } },
    intents: DEFAULT_DISCORD_GATEWAY_INTENTS,
    onDispatch: async () => {},
    webSocketFactory: () => ws,
    readyTimeoutMs: 1000,
    random: () => 0
  });
  const starting = client.start();
  await new Promise((resolve) => setImmediate(resolve));
  ws.emit('message', { data: JSON.stringify({ op: 10, d: { heartbeat_interval: 60_000 } }) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ws.sent.some((payload) => payload.op === 2 && payload.d.token === 'gateway-secret'), true);
  ws.emit('message', { data: JSON.stringify({ op: 0, t: 'READY', s: 1, d: { session_id: 'session-1', resume_gateway_url: 'wss://resume.discord.gg' } }) });
  const status = await starting;
  assert.equal(status.connected, true);
  await client.stop();
  assert.equal(client.status().phase, 'stopped');
  assert.equal(ws.closed, true);
});
