const DEFAULT_SETTINGS = Object.freeze({
  language: null,
  locale: null,
  timeZone: null,
  response: Object.freeze({ mode: 'normal', length: 'normal', markdown: true }),
  units: Object.freeze({ system: 'metric' }),
  formatting: Object.freeze({ date: 'locale', number: 'locale' }),
  accessibility: Object.freeze({ reducedMotion: false, conciseUi: false }),
  notifications: Object.freeze({ enabled: true, quietHours: Object.freeze({ enabled: false, start: '22:00', end: '08:00', timeZone: null }) }),
  delivery: Object.freeze({ preferredTransport: null }),
  autonomy: Object.freeze({ level: 'standard', confirmation: 'policy' })
});

const RESPONSE_MODES = new Set(['short', 'normal', 'long']);
const RESPONSE_LENGTHS = new Set(['short', 'normal', 'long']);
const UNIT_SYSTEMS = new Set(['metric', 'imperial']);
const AUTONOMY_LEVELS = new Set(['manual', 'standard']);
const CONFIRMATION_LEVELS = new Set(['always', 'policy']);
const DATE_FORMATS = new Set(['locale', 'iso']);
const NUMBER_FORMATS = new Set(['locale']);
const TRANSPORTS = new Set(['telegram', 'discord', 'web', 'email', 'voice']);
const TOP_LEVEL = new Set(Object.keys(DEFAULT_SETTINGS));

function required(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}
function clone(value) { return value == null ? value : structuredClone(value); }
function freeze(value) {
  if (!value || typeof value !== 'object') return value;
  for (const item of Object.values(value)) freeze(item);
  return Object.freeze(value);
}
function plainObject(value, field) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}
function canonicalLocale(value) {
  if (value == null || value === '') return null;
  const input = required(String(value).replace('_', '-'), 'locale');
  try { return Intl.getCanonicalLocales(input)[0]; } catch { throw new TypeError('locale must be a valid BCP 47 locale'); }
}
function validTimeZone(value) {
  if (value == null || value === '') return null;
  const zone = required(value, 'timeZone');
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date(0)); return zone; }
  catch { throw new TypeError('timeZone must be a valid IANA timezone'); }
}
function clockTime(value, field) {
  const text = required(value, field);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new TypeError(`${field} must be HH:MM`);
  return text;
}
function enumValue(value, allowed, field) {
  if (!allowed.has(value)) throw new TypeError(`${field} has unsupported value`);
  return value;
}
function booleanValue(value, field) {
  if (typeof value !== 'boolean') throw new TypeError(`${field} must be boolean`);
  return value;
}
function nullableTransport(value) {
  if (value == null || value === '') return null;
  return enumValue(required(value, 'delivery.preferredTransport').toLowerCase(), TRANSPORTS, 'delivery.preferredTransport');
}
function validatePatch(patch) {
  const source = plainObject(patch, 'settings');
  for (const key of Object.keys(source)) if (!TOP_LEVEL.has(key)) throw new TypeError(`unknown user setting: ${key}`);
  const out = {};
  if ('language' in source) out.language = source.language == null || source.language === '' ? null : required(source.language, 'language').toLowerCase();
  if ('locale' in source) out.locale = canonicalLocale(source.locale);
  if ('timeZone' in source) out.timeZone = validTimeZone(source.timeZone);
  if ('response' in source) {
    const value = plainObject(source.response, 'response'); const next = {};
    for (const key of Object.keys(value)) if (!['mode','length','markdown'].includes(key)) throw new TypeError(`unknown response setting: ${key}`);
    if ('mode' in value) next.mode = enumValue(value.mode, RESPONSE_MODES, 'response.mode');
    if ('length' in value) next.length = enumValue(value.length, RESPONSE_LENGTHS, 'response.length');
    if ('markdown' in value) next.markdown = booleanValue(value.markdown, 'response.markdown');
    out.response = next;
  }
  if ('units' in source) {
    const value = plainObject(source.units, 'units');
    for (const key of Object.keys(value)) if (key !== 'system') throw new TypeError(`unknown units setting: ${key}`);
    out.units = 'system' in value ? { system: enumValue(value.system, UNIT_SYSTEMS, 'units.system') } : {};
  }
  if ('formatting' in source) {
    const value = plainObject(source.formatting, 'formatting'); const next = {};
    for (const key of Object.keys(value)) if (!['date','number'].includes(key)) throw new TypeError(`unknown formatting setting: ${key}`);
    if ('date' in value) next.date = enumValue(value.date, DATE_FORMATS, 'formatting.date');
    if ('number' in value) next.number = enumValue(value.number, NUMBER_FORMATS, 'formatting.number');
    out.formatting = next;
  }
  if ('accessibility' in source) {
    const value = plainObject(source.accessibility, 'accessibility'); const next = {};
    for (const key of Object.keys(value)) if (!['reducedMotion','conciseUi'].includes(key)) throw new TypeError(`unknown accessibility setting: ${key}`);
    if ('reducedMotion' in value) next.reducedMotion = booleanValue(value.reducedMotion, 'accessibility.reducedMotion');
    if ('conciseUi' in value) next.conciseUi = booleanValue(value.conciseUi, 'accessibility.conciseUi');
    out.accessibility = next;
  }
  if ('notifications' in source) {
    const value = plainObject(source.notifications, 'notifications'); const next = {};
    for (const key of Object.keys(value)) if (!['enabled','quietHours'].includes(key)) throw new TypeError(`unknown notification setting: ${key}`);
    if ('enabled' in value) next.enabled = booleanValue(value.enabled, 'notifications.enabled');
    if ('quietHours' in value) {
      const quiet = plainObject(value.quietHours, 'notifications.quietHours'); const q = {};
      for (const key of Object.keys(quiet)) if (!['enabled','start','end','timeZone'].includes(key)) throw new TypeError(`unknown quietHours setting: ${key}`);
      if ('enabled' in quiet) q.enabled = booleanValue(quiet.enabled, 'notifications.quietHours.enabled');
      if ('start' in quiet) q.start = clockTime(quiet.start, 'notifications.quietHours.start');
      if ('end' in quiet) q.end = clockTime(quiet.end, 'notifications.quietHours.end');
      if ('timeZone' in quiet) q.timeZone = validTimeZone(quiet.timeZone);
      next.quietHours = q;
    }
    out.notifications = next;
  }
  if ('delivery' in source) {
    const value = plainObject(source.delivery, 'delivery');
    for (const key of Object.keys(value)) if (key !== 'preferredTransport') throw new TypeError(`unknown delivery setting: ${key}`);
    out.delivery = 'preferredTransport' in value ? { preferredTransport: nullableTransport(value.preferredTransport) } : {};
  }
  if ('autonomy' in source) {
    const value = plainObject(source.autonomy, 'autonomy'); const next = {};
    for (const key of Object.keys(value)) if (!['level','confirmation'].includes(key)) throw new TypeError(`unknown autonomy setting: ${key}`);
    if ('level' in value) next.level = enumValue(value.level, AUTONOMY_LEVELS, 'autonomy.level');
    if ('confirmation' in value) next.confirmation = enumValue(value.confirmation, CONFIRMATION_LEVELS, 'autonomy.confirmation');
    out.autonomy = next;
  }
  return out;
}
function deepMerge(base, patch) {
  const result = clone(base);
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) result[key] = deepMerge(result[key], value);
    else result[key] = clone(value);
  }
  return result;
}
function leafPaths(value, prefix = '') {
  const paths = [];
  for (const [key, item] of Object.entries(value ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === 'object' && !Array.isArray(item)) paths.push(...leafPaths(item, path)); else paths.push(path);
  }
  return paths;
}
function getPath(value, path) { return path.split('.').reduce((node, key) => node?.[key], value); }
function setPath(target, path, value) {
  const keys = path.split('.'); let node = target;
  for (const key of keys.slice(0, -1)) node = node[key] ??= {};
  node[keys.at(-1)] = clone(value);
}
function mergeRecords(defaults, globalRecord, projectRecord) {
  const settings = clone(defaults); const provenance = {};
  for (const path of leafPaths(defaults)) provenance[path] = { source: 'default', explicit: false };
  for (const record of [globalRecord, projectRecord]) {
    if (!record) continue;
    const explicit = new Set(record.explicitFields ?? []);
    const inferred = new Set(record.inferredFields ?? []);
    for (const path of leafPaths(record.settings ?? {})) {
      const current = provenance[path];
      const incomingExplicit = explicit.has(path);
      if (!incomingExplicit && inferred.has(path) && current?.explicit) continue;
      setPath(settings, path, getPath(record.settings, path));
      provenance[path] = { source: record.projectScope ? 'project' : 'user', explicit: incomingExplicit, inferred: inferred.has(path), updatedAt: record.updatedAt ?? null, provenance: record.provenance ?? null };
    }
  }
  return { settings, provenance };
}

export function createInMemoryUserSettingsStore() {
  const rows = new Map();
  const key = (id, project) => `${id}\u0000${project ?? ''}`;
  return Object.freeze({
    async get(globalUserId, projectScope = null) { return clone(rows.get(key(globalUserId, projectScope)) ?? null); },
    async set(record) { const stored = freeze(clone(record)); rows.set(key(record.globalUserId, record.projectScope ?? null), stored); return clone(stored); }
  });
}

export function createUserSettingsService({ store = createInMemoryUserSettingsStore(), clock = () => new Date(), defaults = DEFAULT_SETTINGS } = {}) {
  if (!store?.get || !store?.set) throw new TypeError('user settings store with get/set is required');
  const validatedDefaults = deepMerge(DEFAULT_SETTINGS, validatePatch(defaults));

  async function resolve(globalUserId, { projectScope = null, hints = null } = {}) {
    const id = required(globalUserId, 'globalUserId');
    const globalRecord = await store.get(id, null);
    const projectRecord = projectScope ? await store.get(id, required(projectScope, 'projectScope')) : null;
    const merged = mergeRecords(validatedDefaults, globalRecord, projectRecord);
    const validatedHints = hints ? validatePatch(hints) : null;
    if (validatedHints) {
      for (const path of leafPaths(validatedHints)) {
        if (merged.provenance[path]?.explicit) continue;
        setPath(merged.settings, path, getPath(validatedHints, path));
        merged.provenance[path] = { source: 'transport-hint', explicit: false, inferred: true };
      }
    }
    return freeze({ globalUserId: id, projectScope: projectScope ?? null, settings: merged.settings, provenance: merged.provenance });
  }

  async function update(globalUserId, patch, { projectScope = null, source = 'explicit-user-setting', provenance = null, inferred = false } = {}) {
    const id = required(globalUserId, 'globalUserId');
    const project = projectScope == null ? null : required(projectScope, 'projectScope');
    const clean = validatePatch(patch); const paths = leafPaths(clean);
    if (paths.length === 0) throw new TypeError('settings patch must contain at least one value');
    const existing = await store.get(id, project);
    const explicit = new Set(existing?.explicitFields ?? []); const inferredFields = new Set(existing?.inferredFields ?? []);
    for (const path of paths) {
      if (inferred && explicit.has(path)) continue;
      if (inferred) inferredFields.add(path); else { explicit.add(path); inferredFields.delete(path); }
    }
    const effectivePatch = {};
    for (const path of paths) if (!(inferred && explicit.has(path))) setPath(effectivePatch, path, getPath(clean, path));
    const stored = await store.set({
      globalUserId: id, projectScope: project,
      settings: deepMerge(existing?.settings ?? {}, effectivePatch),
      explicitFields: [...explicit].sort(), inferredFields: [...inferredFields].sort(),
      source, provenance: provenance == null ? null : clone(provenance), updatedAt: new Date(clock()).toISOString()
    });
    return freeze(stored);
  }

  async function setPreferredLanguage(globalUserId, language, options = {}) { return update(globalUserId, { language, ...(options.locale !== undefined ? { locale: options.locale } : {}) }, options); }
  async function setTimeZone(globalUserId, timeZone, options = {}) { return update(globalUserId, { timeZone }, options); }

  return Object.freeze({ resolve, update, setPreferredLanguage, setTimeZone, defaults: freeze(clone(validatedDefaults)), validatePatch });
}

export { DEFAULT_SETTINGS as USER_SETTINGS_DEFAULTS };
