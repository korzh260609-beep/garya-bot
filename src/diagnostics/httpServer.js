import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

function secureEqual(actual, expected) {
  const left = Buffer.from(String(actual ?? ''), 'utf8');
  const right = Buffer.from(String(expected ?? ''), 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' });
  response.end(body);
}

function sendHtml(response, statusCode, html) {
  response.writeHead(statusCode, { 'content-type': 'text/html; charset=utf-8', 'content-length': Buffer.byteLength(html), 'cache-control': 'no-store' });
  response.end(html);
}

async function readJson(request, maxBytes = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error('request body too large'), { code: 'body-too-large' });
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function uiHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SG Diagnostics</title><style>body{font-family:system-ui,sans-serif;margin:2rem;max-width:1000px}input,button{font:inherit;padding:.55rem;margin:.25rem}pre{background:#111;color:#eee;padding:1rem;overflow:auto;border-radius:.5rem}.row{display:flex;gap:.5rem;flex-wrap:wrap}.muted{opacity:.7}</style></head><body><h1>SG Diagnostics</h1><p class="muted">Read-only diagnostic console. Full API requires owner authentication headers.</p><div class="row"><input id="trace" placeholder="traceId"><input id="owner" placeholder="global_user_id"><input id="token" type="password" placeholder="diagnostics token"><button onclick="run()">Analyze trace</button><button onclick="health()">System health</button><button onclick="live()">Live probes</button></div><pre id="out">Ready.</pre><script>const out=document.getElementById('out');function headers(){return {'content-type':'application/json','x-sg-global-user-id':document.getElementById('owner').value,'x-diagnostics-token':document.getElementById('token').value}}async function run(){const r=await fetch('/api/request',{method:'POST',headers:headers(),body:JSON.stringify({traceId:document.getElementById('trace').value})});out.textContent=JSON.stringify(await r.json(),null,2)}async function health(){const r=await fetch('/api/system',{method:'POST',headers:headers(),body:'{}'});out.textContent=JSON.stringify(await r.json(),null,2)}async function live(){const r=await fetch('/api/live/run',{method:'POST',headers:headers(),body:'{}'});out.textContent=JSON.stringify(await r.json(),null,2)}</script></body></html>`;
}

export function createDiagnosticsHttpServer({ service, store, host = '0.0.0.0', port = 8790, adminToken, monarchGlobalUserId, environment = 'unknown', revision = 'unknown' } = {}) {
  if (!service?.analyzeRequest || !service?.systemHealth) throw new TypeError('diagnostic service is required');
  if (!store?.getRun || !store?.listRuns) throw new TypeError('diagnostic store is required');
  if (!String(adminToken ?? '').trim()) throw new TypeError('DIAGNOSTICS_ADMIN_TOKEN is required');
  if (!String(monarchGlobalUserId ?? '').trim()) throw new TypeError('SG_MONARCH_GLOBAL_USER_ID is required');

  function authorized(request) {
    return secureEqual(request.headers['x-diagnostics-token'], adminToken)
      && String(request.headers['x-sg-global-user-id'] ?? '') === String(monarchGlobalUserId);
  }

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      if (request.method === 'GET' && url.pathname === '/health') return sendJson(response, 200, { status: 'ok', service: 'sg-diagnostics', environment, revision });
      if (request.method === 'GET' && url.pathname === '/') return sendHtml(response, 200, uiHtml());
      if (url.pathname.startsWith('/api/') && !authorized(request)) return sendJson(response, 403, { ok: false, code: 'diagnostics-owner-auth-required' });

      if (request.method === 'POST' && url.pathname === '/api/request') {
        const body = await readJson(request);
        const result = await service.analyzeRequest({ traceId: body.traceId ?? null, requestId: body.requestId ?? null, pathId: body.pathId ?? null, includeDeployment: body.includeDeployment !== false });
        return sendJson(response, 200, { ok: true, ...result });
      }
      if (request.method === 'POST' && url.pathname === '/api/system') {
        const result = await service.systemHealth();
        return sendJson(response, 200, { ok: true, ...result });
      }
      if (request.method === 'POST' && url.pathname === '/api/live/run') {
        const body = await readJson(request);
        const result = await service.runLive({ probeIds: Array.isArray(body.probeIds) ? body.probeIds : undefined });
        return sendJson(response, result.result.failed ? 409 : 200, { ok: result.result.failed === 0, ...result });
      }
      if (request.method === 'POST' && url.pathname === '/api/regressions/run') {
        const result = await service.runRegressions();
        return sendJson(response, result.failed ? 409 : 200, { ok: result.failed === 0, ...result });
      }
      if (request.method === 'GET' && url.pathname === '/api/runs') {
        const runs = await store.listRuns({ limit: Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50))) });
        return sendJson(response, 200, { ok: true, runs });
      }
      if (request.method === 'GET' && url.pathname.startsWith('/api/runs/')) {
        const runId = decodeURIComponent(url.pathname.slice('/api/runs/'.length));
        const run = await store.getRun(runId);
        if (!run) return sendJson(response, 404, { ok: false, code: 'diagnostic-run-not-found' });
        const evidence = await store.listEvidence({ runId });
        return sendJson(response, 200, { ok: true, run, evidence });
      }
      return sendJson(response, 404, { ok: false, code: 'not-found' });
    } catch (error) {
      const statusCode = error?.code === 'body-too-large' ? 413 : error instanceof SyntaxError ? 400 : 500;
      return sendJson(response, statusCode, { ok: false, code: error?.code ?? 'diagnostics-request-failed', message: statusCode === 500 ? 'diagnostics request failed' : error.message });
    }
  });

  return Object.freeze({
    async start() {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
      const address = server.address();
      return Object.freeze({ host, port: typeof address === 'object' && address ? address.port : port });
    },
    async stop() { if (!server.listening) return; await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); },
    server
  });
}
