import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { scanTextForSecrets } from '../src/operations/securityOperations.js';

const root = process.cwd();
const roots = ['src'];
const findings = [];

async function walk(path) {
  const info = await stat(path);
  if (info.isDirectory()) {
    for (const name of await readdir(path)) await walk(join(path, name));
    return;
  }
  if (!/\.(?:js|json|md|yml|yaml|sql)$/.test(path)) return;
  const content = await readFile(path, 'utf8');
  const scan = scanTextForSecrets(content);
  if (!scan.clean) findings.push({ file: relative(root, path), findings: scan.findings });
}

for (const item of roots) await walk(join(root, item));

if (findings.length > 0) {
  console.error(JSON.stringify({ status: 'security-check-failed', findings }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ status: 'security-check-passed', scannedRoots: roots }));
