const RULES = Object.freeze([
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]'],
  [/\/bot\d+:[A-Za-z0-9_-]+\//g, '/bot[REDACTED]/'],
  [/([?&](?:token|api[_-]?key|secret|password|access[_-]?token|refresh[_-]?token)=)[^&\s]+/gi, '$1[REDACTED]'],
  [/("(?:token|apiKey|api_key|secret|password|accessToken|refreshToken)"\s*:\s*")[^"]+("?)/gi, '$1[REDACTED]$2'],
]);

export function redactSensitiveText(value) {
  let text = String(value ?? '');
  for (const [pattern, replacement] of RULES) text = text.replace(pattern, replacement);
  return text;
}

export function redactSensitiveData(value) {
  if (value == null) return value;
  if (typeof value === 'string') return redactSensitiveText(value);
  if (Array.isArray(value)) return value.map(redactSensitiveData);
  if (typeof value !== 'object') return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    if (/^(?:token|apiKey|api_key|secret|password|accessToken|refreshToken)$/i.test(key)) output[key] = '[REDACTED]';
    else output[key] = redactSensitiveData(child);
  }
  return output;
}
