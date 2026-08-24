function clockMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return (hour * 60) + minute;
}

function parseClock(value) {
  const [hour, minute] = String(value).split(':').map(Number);
  return (hour * 60) + minute;
}

function inQuietHours(minute, start, end) {
  if (start === end) return true;
  if (start < end) return minute >= start && minute < end;
  return minute >= start || minute < end;
}

function nextQuietEnd({ now, timeZone, start, end }) {
  const startMinute = parseClock(start);
  const endMinute = parseClock(end);
  if (!inQuietHours(clockMinutes(now, timeZone), startMinute, endMinute)) return null;

  // Scan real instants rather than synthesizing a local timestamp. This keeps the
  // calculation deterministic across DST gaps/folds and unusual timezone rules.
  const cursor = new Date(now);
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  const maxMinutes = (26 * 60) + 2;
  for (let index = 0; index < maxMinutes; index += 1) {
    if (!inQuietHours(clockMinutes(cursor, timeZone), startMinute, endMinute)) return cursor.toISOString();
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  throw new Error('quiet hours interval has no resolvable delivery window within 26 hours');
}

export function createNotificationDeliveryPolicy({ userSettingsService, clock = () => new Date() } = {}) {
  if (userSettingsService != null && typeof userSettingsService?.resolve !== 'function') {
    throw new TypeError('userSettingsService.resolve must be a function');
  }
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');

  return async function evaluateNotificationDelivery(request) {
    if (request?.kind !== 'self-notification' || !userSettingsService) {
      return Object.freeze({ outcome: 'allow', allowed: true, reason: 'notification-policy-not-applicable' });
    }

    const globalUserId = String(request?.actorGlobalUserId ?? '').trim();
    const projectScope = String(request?.projectScope ?? '').trim() || null;
    if (!globalUserId) {
      return Object.freeze({ outcome: 'deny', allowed: false, reason: 'notification-user-missing' });
    }

    const resolved = await userSettingsService.resolve(globalUserId, { projectScope });
    const notifications = resolved?.settings?.notifications ?? {};
    if (notifications.enabled === false) {
      return Object.freeze({ outcome: 'deny', allowed: false, reason: 'notifications-disabled' });
    }

    const quiet = notifications.quietHours ?? {};
    if (quiet.enabled !== true) {
      return Object.freeze({ outcome: 'allow', allowed: true, reason: 'quiet-hours-disabled' });
    }

    const timeZone = quiet.timeZone || resolved?.settings?.timeZone || 'UTC';
    const now = new Date(clock());
    if (!Number.isFinite(now.getTime())) throw new TypeError('clock must return a valid date');
    const deferUntil = nextQuietEnd({ now, timeZone, start: quiet.start, end: quiet.end });
    if (!deferUntil) {
      return Object.freeze({ outcome: 'allow', allowed: true, reason: 'outside-quiet-hours' });
    }

    return Object.freeze({
      outcome: 'defer',
      allowed: false,
      reason: 'quiet-hours',
      deferUntil,
      timeZone
    });
  };
}
