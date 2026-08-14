import { randomBytes } from 'node:crypto';

export function generateGlobalUserId() {
  return `usr_${randomBytes(8).toString('hex')}`;
}

export function isCanonicalGlobalUserId(value) {
  return /^usr_[0-9a-f]{16}$/i.test(String(value ?? '').trim());
}

export function isLegacyPlatformGlobalUserId(value, { platform, platformUserId } = {}) {
  const id = String(value ?? '').trim();
  const p = String(platform ?? '').trim();
  const puid = String(platformUserId ?? '').trim();
  if (!id || !p || !puid) return false;
  return id === `${p}:${puid}` || (p === 'telegram' && id === `tg:${puid}`);
}
