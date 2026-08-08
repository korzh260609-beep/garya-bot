export function createLanguageSettingsAdapter({ userSettingsService } = {}) {
  if (!userSettingsService?.resolve || !userSettingsService?.setPreferredLanguage) throw new TypeError('userSettingsService is required');
  async function get(globalUserId) {
    const resolved = await userSettingsService.resolve(globalUserId);
    const language = resolved.settings.language;
    if (!language) return null;
    const languageMeta = resolved.provenance.language ?? {};
    const localeMeta = resolved.provenance.locale ?? {};
    return Object.freeze({ language, locale: resolved.settings.locale ?? null, source: languageMeta.source ?? null, provenance: languageMeta.provenance ?? localeMeta.provenance ?? null, updatedAt: languageMeta.updatedAt ?? localeMeta.updatedAt ?? null });
  }
  async function set(globalUserId, record) {
    await userSettingsService.setPreferredLanguage(globalUserId, record.language, { locale: record.locale ?? null, source: record.source ?? 'explicit-user-setting', provenance: record.provenance ?? null, inferred: record.inferred === true });
    return get(globalUserId);
  }
  return Object.freeze({ get, set });
}

export function createTimezoneSettingsAdapter({ userSettingsService } = {}) {
  if (!userSettingsService?.resolve || !userSettingsService?.setTimeZone) throw new TypeError('userSettingsService is required');
  async function get(globalUserId) {
    const resolved = await userSettingsService.resolve(globalUserId);
    const timeZone = resolved.settings.timeZone;
    if (!timeZone) return null;
    const meta = resolved.provenance.timeZone ?? {};
    return Object.freeze({ timeZone, source: meta.source ?? null, provenance: meta.provenance ?? null, updatedAt: meta.updatedAt ?? null });
  }
  async function set(globalUserId, record) {
    await userSettingsService.setTimeZone(globalUserId, record.timeZone, { source: record.source ?? 'explicit-user-setting', provenance: record.provenance ?? null, inferred: record.inferred === true });
    return get(globalUserId);
  }
  return Object.freeze({ get, set });
}
