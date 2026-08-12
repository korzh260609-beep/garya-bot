import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

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

test('TWM1.6 production wiring composes authority + configuration service over the canonical workspace store', async () => {
  const source = await readFile(new URL('../src/runtime/renderWebApplication.js', import.meta.url), 'utf8');
  assert.match(source, /createPostgresTelegramWorkspaceAuthorityResolver/);
  assert.match(source, /createTelegramWorkspaceConfigurationService/);
  assert.match(source, /const workspaceStore = telegramUpdateStore\.workspaceRegistry\?\.store \?\? null/);
  assert.match(source, /workspaceStore,\s*authorityResolver: telegramWorkspaceAuthority/);
  assert.match(source, /eventBus: harness\.eventBus \?\? null/);
  assert.match(source, /telegramWorkspaceConfiguration/);
});

test('TWM1.6 application code has one workspace config write owner: WorkspaceConfigurationService', async () => {
  const srcRoot = new URL('../src/', import.meta.url);
  const files = await javascriptFiles(srcRoot);
  const directWorkspaceWrites = [];
  const directConfigSqlWrites = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const path = relative(new URL('../', import.meta.url).pathname, file);
    if (/workspaceStore\.setConfig\s*\(/.test(source)) directWorkspaceWrites.push(path);
    if (/\b(?:INSERT\s+INTO|UPDATE)\s+telegram_workspace_configs\b/i.test(source)) directConfigSqlWrites.push(path);
  }
  assert.deepEqual(directWorkspaceWrites, ['src/telegramWorkspace/workspaceConfigurationService.js']);
  assert.deepEqual(directConfigSqlWrites, ['src/telegramWorkspace/postgresWorkspaceStore.js']);
});

test('TWM1.6 reuses the TWM1.2 migration instead of introducing a second config persistence stack', async () => {
  const migration = await readFile(new URL('../src/persistence/migrations/900_twm1_workspace_persistence.sql', import.meta.url), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS telegram_workspace_configs/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS telegram_workspace_config_history/);
  assert.match(migration, /UNIQUE\(workspace_id, namespace, version\)/);
});
