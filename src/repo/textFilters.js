// ============================================================================
// === src/repo/textFilters.js — text file validation (12A.0.4)
// ============================================================================

export const MAX_TEXT_FILE_SIZE = 200 * 1024; // 200 KB

const DENY_PREFIXES = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  ".next/",
  ".render/",
  "coverage/",
  "tmp/",
  "temp/",
  "vendor/",
];

const DENY_EXACT = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".npmrc",
  ".yarnrc",
]);

const ALLOW_EXT = [
  ".js",
  ".ts",
  ".json",
  ".md",
  ".sql",
  ".yml",
  ".yaml",
  ".txt",
  ".rtf",
];

const BINARY_SIGNATURES = [
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff], // JPG
  [0x47, 0x49, 0x46, 0x38], // GIF
  [0x25, 0x50, 0x44, 0x46], // PDF
  [0x50, 0x4b, 0x03, 0x04], // ZIP/DOCX/XLSX/JAR
];

function safeStr(v) {
  return v == null ? "" : String(v);
}

function lowerPath(path) {
  return safeStr(path).trim().replace(/^\/+/, "").toLowerCase();
}

function hasAllowedExtension(path) {
  return ALLOW_EXT.some((ext) => path.endsWith(ext));
}

function startsWithDeniedPrefix(path) {
  return DENY_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function looksSensitiveByPath(path) {
  return (
    path.includes(".env") ||
    path.includes("secret") ||
    path.includes("token") ||
    path.includes("apikey") ||
    path.includes("api_key") ||
    path.includes("private") ||
    path.includes("credential") ||
    path.includes("passwd") ||
    path.includes("password") ||
    path.includes("id_rsa") ||
    path.includes(".pem") ||
    path.includes(".key") ||
    path.includes("secrets/")
  );
}

function matchesBinarySignature(buffer) {
  if (!buffer || typeof buffer.length !== "number" || buffer.length === 0) {
    return false;
  }

  return BINARY_SIGNATURES.some((sig) => {
    if (buffer.length < sig.length) return false;
    for (let i = 0; i < sig.length; i += 1) {
      if (buffer[i] !== sig[i]) return false;
    }
    return true;
  });
}

export function isAllowedTextPath(path) {
  const p = lowerPath(path);
  if (!p) return false;
  if (p.length > 300) return false;
  if (DENY_EXACT.has(p)) return false;
  if (startsWithDeniedPrefix(p)) return false;
  if (looksSensitiveByPath(p)) return false;
  if (!hasAllowedExtension(p)) return false;
  return true;
}

export function isProbablyText(buffer) {
  if (!buffer || typeof buffer.length !== "number") return false;
  if (buffer.length === 0) return true;
  if (buffer.length > MAX_TEXT_FILE_SIZE) return false;
  if (matchesBinarySignature(buffer)) return false;

  let suspicious = 0;
  const len = Math.min(buffer.length, 4096);

  for (let i = 0; i < len; i += 1) {
    const byte = buffer[i];

    // allow common text control chars
    if (byte === 9 || byte === 10 || byte === 13) continue;

    // null byte = strong binary sign
    if (byte === 0) return false;

    // printable ASCII
    if (byte >= 32 && byte <= 126) continue;

    // extended bytes may be valid UTF-8 fragments, tolerate some
    if (byte >= 128) continue;

    suspicious += 1;
  }

  return suspicious <= Math.max(8, Math.floor(len * 0.01));
}