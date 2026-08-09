import { createHash } from 'node:crypto';

export function normalizeFinalResponseText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\u00a0]+/gu, ' ')
    .replace(/^[\s"'«»„“”‘’`]+|[\s"'«»„“”‘’`]+$/gu, '')
    .trim();
}

export function fingerprintFinalResponse(value, { salt = '' } = {}) {
  const normalized = normalizeFinalResponseText(value);
  return createHash('sha256').update(String(salt)).update('\0').update(normalized).digest('hex');
}

export function assessFinalResponse({ userText, candidateText } = {}) {
  const user = normalizeFinalResponseText(userText);
  const candidate = normalizeFinalResponseText(candidateText);
  if (!candidate) return Object.freeze({ ok: false, reason: 'empty-response' });
  if (user && candidate === user) return Object.freeze({ ok: false, reason: 'exact-user-echo' });
  return Object.freeze({ ok: true, reason: null });
}
