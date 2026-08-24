function requiredFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} is required`);
  return value;
}

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export class DiscordGatewayError extends Error {
  constructor(message, { code = 'discord-gateway-error', retryable = true } = {}) {
    super(message);
    this.name = 'DiscordGatewayError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function createDiscordGatewayClient({
  restClient,
  credentialManager = null,
  credentialAccessContext = null,
  credentialId = 'sg.discord.bot',
  intents,
  onDispatch,
  observability = null,
  webSocketFactory = (url) => new WebSocket(url),
  readyTimeoutMs = 15_000,
  reconnectMinMs = 1_000,
  reconnectMaxMs = 30_000,
  random = Math.random
} = {}) {
  if (!restClient || typeof restClient.getGatewayBot !== 'function') throw new TypeError('restClient.getGatewayBot is required');
  requiredFunction(onDispatch, 'onDispatch');
  requiredFunction(webSocketFactory, 'webSocketFactory');
  if (!Number.isSafeInteger(intents) || intents < 0) throw new TypeError('discord gateway intents must be a non-negative integer');
  const hasCredentialManager = credentialManager && typeof credentialManager.useCredential === 'function';
  if (!hasCredentialManager) throw new TypeError('Discord Gateway requires credentialManager');
  if (!credentialAccessContext?.actor || !credentialAccessContext?.scope) throw new TypeError('discord gateway credential access context is required');

  let socket = null;
  let phase = 'created';
  let stopping = false;
  let sessionId = null;
  let resumeGatewayUrl = null;
  let sequence = null;
  let heartbeatTimer = null;
  let heartbeatAcked = true;
  let reconnectAttempt = 0;
  let connectPromise = null;
  let readyResolve = null;
  let readyReject = null;
  let lastError = null;
  let gatewayUrl = null;

  function snapshot() {
    return Object.freeze({
      phase,
      connected: phase === 'ready',
      sessionResumable: Boolean(sessionId && resumeGatewayUrl),
      sequence,
      reconnectAttempt,
      lastError: lastError ? { code: lastError.code ?? 'discord-gateway-error', message: String(lastError.message ?? 'gateway failure').slice(0, 180) } : null
    });
  }

  function record(outcome, data = {}) {
    try {
      observability?.record?.({
        eventClass: 'audit_event',
        channel: 'telemetry',
        stage: 'discord-gateway',
        outcome,
        data: { discordGatewayEventClass: 'discord_gateway_state', ...data }
      });
    } catch {}
  }

  function clearHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  function send(payload) {
    if (!socket || socket.readyState !== 1) throw new DiscordGatewayError('Discord Gateway socket is not open', { code: 'discord-gateway-not-open' });
    socket.send(JSON.stringify(payload));
  }

  function heartbeat() {
    if (!heartbeatAcked) {
      try { socket?.close?.(4000, 'heartbeat timeout'); } catch {}
      return;
    }
    heartbeatAcked = false;
    try { send({ op: 1, d: sequence }); } catch {}
  }

  async function identify() {
    return credentialManager.useCredential({
      credentialId,
      actor: credentialAccessContext.actor,
      scope: credentialAccessContext.scope,
      purpose: 'discord.gateway.identify',
      connectionId: 'discord',
      operation: async (token) => {
        send({
          op: 2,
          d: {
            token: requiredString(token, 'discord bot token'),
            intents,
            properties: { os: process.platform, browser: 'sg-2.1', device: 'sg-2.1' }
          }
        });
      }
    });
  }

  async function resume() {
    return credentialManager.useCredential({
      credentialId,
      actor: credentialAccessContext.actor,
      scope: credentialAccessContext.scope,
      purpose: 'discord.gateway.resume',
      connectionId: 'discord',
      operation: async (token) => send({ op: 6, d: { token: requiredString(token, 'discord bot token'), session_id: sessionId, seq: sequence } })
    });
  }

  async function handleHello(data) {
    const interval = Number(data?.heartbeat_interval);
    if (!Number.isFinite(interval) || interval <= 0) throw new DiscordGatewayError('Discord Gateway HELLO heartbeat interval is invalid', { code: 'discord-gateway-invalid-hello', retryable: false });
    clearHeartbeat();
    heartbeatAcked = true;
    setTimeout(() => { if (!stopping && socket?.readyState === 1) heartbeat(); }, Math.floor(random() * interval));
    heartbeatTimer = setInterval(heartbeat, interval);
    if (sessionId && sequence != null) await resume();
    else await identify();
  }

  async function handleMessage(raw) {
    let payload;
    try { payload = JSON.parse(typeof raw === 'string' ? raw : raw?.data ?? raw); }
    catch { throw new DiscordGatewayError('Discord Gateway payload is not valid JSON', { code: 'discord-gateway-invalid-payload' }); }
    if (payload.s != null) sequence = payload.s;
    if (payload.op === 10) return handleHello(payload.d);
    if (payload.op === 11) { heartbeatAcked = true; return; }
    if (payload.op === 7) { try { socket?.close?.(4000, 'server requested reconnect'); } catch {}; return; }
    if (payload.op === 9) {
      const resumable = payload.d === true;
      if (!resumable) { sessionId = null; resumeGatewayUrl = null; sequence = null; }
      try { socket?.close?.(4000, resumable ? 'invalid session resume' : 'invalid session identify'); } catch {}
      return;
    }
    if (payload.op !== 0) return;
    if (payload.t === 'READY') {
      sessionId = payload.d?.session_id ?? null;
      resumeGatewayUrl = payload.d?.resume_gateway_url ?? null;
      phase = 'ready';
      reconnectAttempt = 0;
      record('ready', { sessionResumable: Boolean(sessionId) });
      readyResolve?.(snapshot());
      readyResolve = null; readyReject = null;
    } else if (payload.t === 'RESUMED') {
      phase = 'ready';
      reconnectAttempt = 0;
      record('resumed');
      readyResolve?.(snapshot());
      readyResolve = null; readyReject = null;
    }
    await onDispatch(Object.freeze({ type: payload.t, data: payload.d, sequence: payload.s }));
  }

  function bind(ws) {
    ws.addEventListener?.('message', (event) => { Promise.resolve(handleMessage(event.data)).catch((error) => { lastError = error; record('dispatch-failed', { code: error.code ?? 'discord-gateway-dispatch-failed' }); }); });
    ws.addEventListener?.('error', () => { lastError = new DiscordGatewayError('Discord Gateway socket error', { code: 'discord-gateway-socket-error' }); });
    ws.addEventListener?.('close', (event) => { void handleClose(event); });
    if (!ws.addEventListener) {
      ws.onmessage = (event) => { Promise.resolve(handleMessage(event.data)).catch((error) => { lastError = error; }); };
      ws.onerror = () => { lastError = new DiscordGatewayError('Discord Gateway socket error', { code: 'discord-gateway-socket-error' }); };
      ws.onclose = (event) => { void handleClose(event); };
    }
  }

  async function handleClose(event = {}) {
    clearHeartbeat();
    socket = null;
    const code = Number(event.code ?? 0);
    const fatal = [4004, 4010, 4011, 4012, 4013, 4014].includes(code);
    if (stopping) { phase = 'stopped'; return; }
    if (fatal) {
      phase = 'failed';
      lastError = new DiscordGatewayError(`Discord Gateway closed with fatal code ${code}`, { code: `discord-gateway-close-${code}`, retryable: false });
      readyReject?.(lastError); readyResolve = null; readyReject = null;
      record('failed', { closeCode: code });
      return;
    }
    phase = 'reconnecting';
    reconnectAttempt += 1;
    const waitMs = Math.min(reconnectMaxMs, reconnectMinMs * (2 ** Math.max(0, reconnectAttempt - 1)));
    record('reconnecting', { closeCode: code, waitMs, reconnectAttempt });
    await delay(waitMs);
    if (!stopping) connectPromise = connectSocket().catch((error) => { lastError = error; phase = 'failed'; readyReject?.(error); readyResolve = null; readyReject = null; throw error; });
  }

  async function connectSocket() {
    phase = reconnectAttempt > 0 ? 'reconnecting' : 'connecting';
    if (!gatewayUrl) {
      const info = await restClient.getGatewayBot();
      gatewayUrl = requiredString(info?.url, 'Discord Gateway URL');
    }
    const base = (sessionId && resumeGatewayUrl) ? resumeGatewayUrl : gatewayUrl;
    const separator = base.includes('?') ? '&' : '?';
    const url = `${base}${separator}v=10&encoding=json`;
    const ws = webSocketFactory(url);
    socket = ws;
    bind(ws);
    return snapshot();
  }

  async function start() {
    if (!['created', 'stopped'].includes(phase)) return connectPromise ?? snapshot();
    stopping = false;
    phase = 'connecting';
    const readyPromise = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    const timeout = setTimeout(() => {
      const error = new DiscordGatewayError('Discord Gateway READY timed out', { code: 'discord-gateway-ready-timeout' });
      lastError = error;
      readyReject?.(error); readyResolve = null; readyReject = null;
      try { socket?.close?.(4000, 'ready timeout'); } catch {}
    }, readyTimeoutMs);
    connectPromise = connectSocket();
    try {
      await connectPromise;
      return await readyPromise;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function stop() {
    stopping = true;
    clearHeartbeat();
    const ws = socket;
    socket = null;
    if (ws && ws.readyState < 2) {
      try { ws.close(1000, 'SG shutdown'); } catch {}
    }
    phase = 'stopped';
    record('stopped');
  }

  return Object.freeze({ start, stop, status: snapshot });
}
