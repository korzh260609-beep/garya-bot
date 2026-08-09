function comparable(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\u00a0]+/gu, ' ')
    .replace(/^[\s"'«»„“”‘’`]+|[\s"'«»„“”‘’`]+$/gu, '')
    .trim();
}

export function assessFinalResponse({ userText, candidateText } = {}) {
  const user = comparable(userText);
  const candidate = comparable(candidateText);
  if (!candidate) return Object.freeze({ ok: false, reason: 'empty-response' });
  if (user && candidate === user) return Object.freeze({ ok: false, reason: 'exact-user-echo' });
  return Object.freeze({ ok: true, reason: null });
}
