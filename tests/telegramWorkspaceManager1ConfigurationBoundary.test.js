import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

async function javascriptFiles(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(path);
    }
  }
  await walk(root);
  return files;
}

test('TWM1.7 production wiring composes the canonical SG Action Gate before WorkspaceConfigurationService', async () => {
  const source = await readFile(new URL('../src/runtime/renderWebApplication.js', import.meta.url), 'utf8');
  assert.match(source, /createPostgresTelegramWorkspaceAuthorityResolver/);
  assert.match(source, /createTelegramWorkspaceActionGateIntegration/);
  assert.match(source, /actionGate:\s*harness\.actionGate/);
  assert.match(source, /policyContextResolver:\s*\(\) => harness\.policyLayer\?\.resolve\?\.\(\) \?\? null/);
  assert.match(source, /createTelegramWorkspaceConfigurationService/);
  assert.match(source, /mutationGate:\s*telegramWorkspaceMutationGate/);
  assert.match(source, /const workspaceStore = telegramUpdateStore\.workspaceRegistry\?\.store \?\? null/);
  assert.match(source, /telegramWorkspaceMutationGate/);
  assert.match(source, /telegramWorkspaceConfiguration/);
});

test('TWM1.7 application code has one workspace config write owner and it is internally action-gated', async () => {
  const projectRoot = fileURLToPath(new URL('../', import.meta.url));
  const srcRoot = fileURLToPath(new URL('../src/', import.meta.url));
  const files = await javascriptFiles(srcRoot);
  const directWorkspaceWrites = [];
  const directConfigSqlWrites = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const path = relative(projectRoot, file).replaceAll('\\', '/');
    if (/workspaceStore\.setConfig\s*\(/.test(source)) directWorkspaceWrites.push(path);
    if (/\b(?:INSERT\s+INTO|UPDATE)\s+telegram_workspace_configs\b/i.test(source)) directConfigSqlWrites.push(path);
  }
  assert.deepEqual(directWorkspaceWrites, ['src/telegramWorkspace/workspaceConfigurationService.js']);
  assert.deepEqual(directConfigSqlWrites, ['src/telegramWorkspace/postgresWorkspaceStore.js']);

  const serviceSource = await readFile(new URL('../src/telegramWorkspace/workspaceConfigurationService.js', import.meta.url), 'utf8');
  assert.match(serviceSource, /mutationGate\.evaluateMutation\s*\(/);
  assert.match(serviceSource, /if \(typeof mutationGate\?\.evaluateMutation !== 'function'\) throw new TypeError/);
  assert.doesNotMatch(serviceSource, /confirmed\s*=\s*false/);
  assert.doesNotMatch(serviceSource, /confirmed\s*===\s*true/);
});

test('TWM1.7 reuses the TWM1.2 migration instead of introducing a second config persistence stack', async () => {
  const migration = await readFile(new URL('../src/persistence/migrations/900_twm1_workspace_persistence.sql', import.meta.url), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS telegram_workspace_configs/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS telegram_workspace_config_history/);
  assert.match(migration, /UNIQUE\(workspace_id, namespace, version\)/);
});
