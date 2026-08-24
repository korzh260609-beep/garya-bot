const DEFAULT_PATH = '/telegram/mini-app';
const MAX_BODY_BYTES = 64 * 1024;
const INTERNAL_RESPONSE_KEYS = new Set([
  'workspaceId', 'workspace_id',
  'actorGlobalUserId', 'actor_global_user_id',
  'updatedByGlobalUserId', 'updated_by_global_user_id',
  'telegramUserId', 'telegram_user_id',
  'traceId', 'trace_id',
  'historyId', 'history_id'
]);

function normalizePath(value) {
  if (value === null || value === false) return null;
  const path = String(value ?? DEFAULT_PATH).trim();
  if (!path.startsWith('/')) throw new TypeError('Mini App path must start with /');
  return path.replace(/\/+$/, '') || DEFAULT_PATH;
}

function publicProjection(value) {
  if (Array.isArray(value)) return value.map(publicProjection);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !INTERNAL_RESPONSE_KEYS.has(key))
    .map(([key, nested]) => [key, publicProjection(nested)]));
}

function json(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(publicProjection(body)));
}

function html(response, body) {
  response.statusCode = 200;
  response.setHeader('content-type', 'text/html; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'");
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) {
      const error = new Error('request body too large');
      error.code = 'twm-mini-app-request-too-large';
      throw error;
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {
    const error = new Error('invalid JSON body');
    error.code = 'twm-mini-app-json-invalid';
    throw error;
  }
}

function initDataFrom(request) {
  const value = request.headers?.['x-telegram-init-data'];
  return Array.isArray(value) ? value[0] : value;
}

function statusFor(error) {
  const code = String(error?.code ?? '');
  if (code.includes('signature') || code.includes('init-data') || code.includes('auth-date') || code.includes('identity')) return 401;
  if (code.includes('authority') || code.includes('denied') || code.includes('revoked')) return 403;
  if (code.includes('stale') || code.includes('conflict') || code.includes('noop') || code.includes('replay')) return 409;
  return 400;
}

function shell(path) {
  const apiBase = `${path}/api`;
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>SG Workspace Manager</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
:root{font-family:system-ui,-apple-system,sans-serif;color:var(--tg-theme-text-color,#111);background:var(--tg-theme-bg-color,#fff)}
*{box-sizing:border-box}body{margin:0;padding:16px;max-width:760px;margin-inline:auto}h1{font-size:22px;margin:0 0 4px}.muted{color:var(--tg-theme-hint-color,#777);font-size:13px}.card{border:1px solid var(--tg-theme-section-separator-color,#ddd);border-radius:14px;padding:14px;margin:12px 0;background:var(--tg-theme-secondary-bg-color,#f6f6f6)}label{display:block;font-size:13px;margin:10px 0 4px}select,input,button{font:inherit;width:100%;padding:10px;border-radius:10px;border:1px solid #bbb;background:var(--tg-theme-bg-color,#fff);color:inherit}button{cursor:pointer;background:var(--tg-theme-button-color,#2481cc);color:var(--tg-theme-button-text-color,#fff);border:0;margin-top:8px}.secondary{background:transparent;color:var(--tg-theme-link-color,#2481cc);border:1px solid currentColor}.row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.hidden{display:none}.status{white-space:pre-wrap;font-size:13px}.danger{color:#b42318}@media(max-width:520px){.row{grid-template-columns:1fr}}
</style>
</head>
<body>
<h1>Советник GARYA</h1><div class="muted">Telegram Workspace Manager · Mini App</div>
<div id="status" class="card status">Подключение…</div>
<div id="app" class="hidden">
  <div class="card"><label>Группа или канал</label><select id="workspace"></select><div id="workspaceMeta" class="muted"></div></div>
  <div id="sections"></div>
  <div class="card"><button id="history" class="secondary">История конфигурации</button><div id="historyOut" class="muted"></div></div>
</div>
<script>
const tg=window.Telegram?.WebApp; tg?.ready(); tg?.expand();
const initData=tg?.initData||''; const api=${JSON.stringify(apiBase)};
const statusEl=document.getElementById('status'),appEl=document.getElementById('app'),workspaceEl=document.getElementById('workspace'),sectionsEl=document.getElementById('sections'),metaEl=document.getElementById('workspaceMeta'),historyOut=document.getElementById('historyOut');
let current=null,workspaceRows=[];
async function call(route,body={}){const r=await fetch(api+route,{method:'POST',headers:{'content-type':'application/json','x-telegram-init-data':initData},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Object.assign(new Error(data.code||'request-failed'),data);return data;}
function say(text,bad=false){statusEl.textContent=text;statusEl.classList.toggle('danger',bad)}
function workspaceLabel(w){return w.title||w.username||({group:'Группа',supergroup:'Супергруппа',channel:'Канал'}[w.workspaceType]||'Workspace')}
function configMap(rows){return Object.fromEntries((rows||[]).map(r=>[r.namespace,r]))}
function enabledCard(ns,title,row){const checked=row?.config?.enabled===true?'checked':'';return '<div class="card" data-ns="'+ns+'"><b>'+title+'</b><label><input data-field="enabled" type="checkbox" '+checked+'> Включено</label><div class="muted">Версия: '+(row?.version||0)+'</div><button data-save="'+ns+'">Сохранить</button></div>'}
function render(detail){current=detail;const m=configMap(detail.configs);let out='';const r=m.responses;out+='<div class="card" data-ns="responses"><b>Ответы</b><label>Режим</label><select data-field="mode"><option value="mention_only">Только по обращению</option><option value="all">На все сообщения</option><option value="off">Выключено</option></select><div class="muted">Версия: '+(r?.version||0)+'</div><button data-save="responses">Сохранить</button></div>';
out+=enabledCard('moderation','Модерация',m.moderation)+enabledCard('memory','Память',m.memory)+enabledCard('ai','AI-функции',m.ai)+enabledCard('publication','Публикации',m.publication)+enabledCard('automation','Автоматизация',m.automation)+enabledCard('notifications','Уведомления',m.notifications)+enabledCard('members','Участники и роли',m.members);sectionsEl.innerHTML=out;
const mode=sectionsEl.querySelector('[data-ns="responses"] [data-field="mode"]');mode.value=r?.config?.mode||((r?.config?.enabled===false)?'off':'mention_only');
const cap=detail.capabilityHealth;metaEl.textContent=cap?('Бот: '+(cap.available?'готов':'ограничен')+(cap.status?' · '+cap.status:'')):'';
sectionsEl.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>save(b.dataset.save));}
function nextConfig(ns){const m=configMap(current.configs),before=structuredClone(m[ns]?.config||{}),card=sectionsEl.querySelector('[data-ns="'+ns+'"]');if(ns==='responses'){const mode=card.querySelector('[data-field="mode"]').value;return {...before,enabled:mode!=='off',reply_enabled:mode!=='off',mode};}return {...before,enabled:card.querySelector('[data-field="enabled"]').checked};}
async function save(ns){try{say('Проверяю изменение…');const next=nextConfig(ns);const p=await call('/propose',{workspaceRef:workspaceEl.value,namespace:ns,nextConfig:next});const paths=(p.changedPaths||[]).join(', ')||'без изменений';if(!confirm('Подтвердить изменение?\\nРиск: '+p.risk+'\\nИзменения: '+paths)){say('Изменение отменено.');return;}await call('/apply',{confirmationToken:p.confirmationToken,confirmed:true});say('Сохранено.');await loadWorkspace();}catch(e){say('Ошибка: '+e.message,true)}}
async function loadWorkspace(){const detail=await call('/workspace',{workspaceRef:workspaceEl.value});render(detail)}
workspaceEl.onchange=()=>loadWorkspace().catch(e=>say('Ошибка: '+e.message,true));
document.getElementById('history').onclick=async()=>{try{const m=configMap(current?.configs);const names=Object.keys(m);if(!names.length){historyOut.textContent='История пока пуста.';return;}const blocks=[];for(const ns of names){const rows=await call('/history',{workspaceRef:workspaceEl.value,namespace:ns,limit:5});blocks.push(ns+': '+((rows||[]).map(x=>'v'+x.version).join(', ')||'пусто'));}historyOut.textContent=blocks.join('\\n')}catch(e){say('Ошибка: '+e.message,true)}};
(async()=>{try{if(!initData)throw new Error('Открой Mini App из Telegram.');const b=await call('/bootstrap');workspaceRows=b.workspaces||[];if(!workspaceRows.length){say('Нет доступных групп или каналов.');return;}workspaceEl.replaceChildren(...workspaceRows.map(w=>{const option=document.createElement('option');option.value=w.workspaceRef;option.textContent=workspaceLabel(w);return option;}));appEl.classList.remove('hidden');say('Подключено.');await loadWorkspace()}catch(e){say('Ошибка запуска: '+e.message,true)}})();
</script>
</body></html>`;
}

export function createTelegramWorkspaceMiniAppHttpHandler({ service, path = DEFAULT_PATH } = {}) {
  for (const method of ['bootstrap', 'workspace', 'propose', 'apply', 'history', 'rollback']) {
    if (typeof service?.[method] !== 'function') throw new TypeError(`Mini App service.${method} is required`);
  }
  const basePath = normalizePath(path);
  const apiPath = basePath == null ? null : `${basePath}/api`;

  return async function handle(request, response) {
    if (basePath == null) return false;
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === basePath && request.method === 'GET') {
      html(response, shell(basePath));
      return true;
    }
    if (!url.pathname.startsWith(`${apiPath}/`)) return false;
    if (request.method !== 'POST') {
      json(response, 405, { ok: false, code: 'method-not-allowed' });
      return true;
    }

    try {
      const initData = initDataFrom(request);
      const body = await readJson(request);
      const input = { ...body, initData };
      let result;
      if (url.pathname === `${apiPath}/bootstrap`) result = await service.bootstrap(input);
      else if (url.pathname === `${apiPath}/workspace`) result = await service.workspace(input);
      else if (url.pathname === `${apiPath}/propose`) result = await service.propose(input);
      else if (url.pathname === `${apiPath}/apply`) result = await service.apply(input);
      else if (url.pathname === `${apiPath}/history`) result = await service.history(input);
      else if (url.pathname === `${apiPath}/rollback`) result = await service.rollback(input);
      else {
        json(response, 404, { ok: false, code: 'not-found' });
        return true;
      }
      json(response, 200, result);
    } catch (error) {
      json(response, statusFor(error), { ok: false, code: error?.code ?? 'twm-mini-app-request-failed' });
    }
    return true;
  };
}

export const TELEGRAM_WORKSPACE_MINI_APP_PATH = DEFAULT_PATH;
