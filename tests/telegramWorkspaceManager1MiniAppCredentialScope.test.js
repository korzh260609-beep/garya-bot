import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const productionSourceUrl = new URL('../src/runtime/renderWebApplication.js', import.meta.url);

test('TWM1.13 production Mini App reuses canonical Telegram credential connection scope', async () => {
  const source = await readFile(productionSourceUrl, 'utf8');
  const start = source.indexOf('const telegramWorkspaceMiniApp =');
  const end = source.indexOf('const telegramMiniAppHandler =', start);

  assert.notEqual(start, -1, 'production Mini App composition is missing');
  assert.notEqual(end, -1, 'production Mini App composition boundary is missing');

  const miniAppComposition = source.slice(start, end);
  assert.match(miniAppComposition, /purpose:\s*'telegram\.mini-app\.verify-init-data'/);
  assert.match(miniAppComposition, /connectionId:\s*'telegram'/);
  assert.doesNotMatch(miniAppComposition, /connectionId:\s*'telegram-mini-app'/);
});
