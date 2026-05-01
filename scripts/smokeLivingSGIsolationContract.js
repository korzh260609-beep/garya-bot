// scripts/smokeLivingSGIsolationContract.js
// ============================================================================
// LIVING SG ISOLATION CONTRACT SMOKE CHECK
//
// Purpose:
// - verify Living SG skeleton stays isolated from legacy command routers;
// - verify Living SG skeleton does not import projectIntent runtime;
// - verify Living SG skeleton does not import diagnostic bridges;
// - verify Living SG skeleton does not import repo/runtime execution layers;
// - does not call AI;
// - does not read/write repo/runtime state;
// - does not connect tools or state-changing actions.
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const livingSgDir = path.join(repoRoot, "src", "core", "living-sg");

const forbiddenResolvedPathParts = [
  path.join("src", "bot", "router"),
  path.join("src", "bot", "diagnostics"),
  path.join("src", "core", "projectIntent"),
  path.join("src", "core", "repo"),
  path.join("src", "core", "repoState"),
  path.join("src", "services", "repo"),
  path.join("src", "services", "github"),
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Living SG isolation contract failed: ${message}`);
  }
}

function toPosix(value) {
  return String(value || "").replaceAll(path.sep, "/");
}

function listJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listJsFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractImportSpecifiers(content) {
  const specifiers = [];
  const staticImportRegex = /from\s+["']([^"']+)["']/g;
  const sideEffectImportRegex = /import\s+["']([^"']+)["']/g;
  const dynamicImportRegex = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
  const requireRegex = /require\s*\(\s*["']([^"']+)["']\s*\)/g;

  for (const regex of [
    staticImportRegex,
    sideEffectImportRegex,
    dynamicImportRegex,
    requireRegex,
  ]) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      specifiers.push(match[1]);
    }
  }

  return specifiers;
}

function resolveLocalImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;

  return path.normalize(path.resolve(path.dirname(fromFile), specifier));
}

assert(fs.existsSync(livingSgDir), "src/core/living-sg directory must exist");

const files = listJsFiles(livingSgDir);
assert(files.length > 0, "src/core/living-sg must contain JavaScript files");

const violations = [];

for (const filePath of files) {
  const content = fs.readFileSync(filePath, "utf8");
  const imports = extractImportSpecifiers(content);

  for (const specifier of imports) {
    const resolved = resolveLocalImport(filePath, specifier);
    if (!resolved) continue;

    const relativeResolved = path.relative(repoRoot, resolved);
    const normalizedResolved = toPosix(relativeResolved);

    for (const forbiddenPart of forbiddenResolvedPathParts) {
      const normalizedForbiddenPart = toPosix(forbiddenPart);

      if (normalizedResolved.includes(normalizedForbiddenPart)) {
        violations.push({
          file: toPosix(path.relative(repoRoot, filePath)),
          import: specifier,
          resolved: normalizedResolved,
          forbidden: normalizedForbiddenPart,
        });
      }
    }
  }
}

if (violations.length > 0) {
  const details = violations
    .map((item) => `${item.file} imports ${item.import} -> ${item.resolved} forbidden by ${item.forbidden}`)
    .join("\n");

  throw new Error(`Living SG isolation contract failed:\n${details}`);
}

console.log("OK: Living SG skeleton is isolated from legacy router/projectIntent/diagnostic/repo execution imports.");
