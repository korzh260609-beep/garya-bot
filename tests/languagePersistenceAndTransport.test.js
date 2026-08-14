import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresDatabase } from '../src/persistence/database.js';
import { runMigrations } from '../src/persistence/migrator.js';
import { createPostgresLanguageStore } from '../src/language/postgresLanguageStore.js';
import { createTelegramTransportAdapter } from '../src/interfaces/adapters.js';

const databaseUrl = process.env.DATABASE_URL;

test('PostgreSQL language preference persists inside users.profile without schema changes', { skip: !databaseUrl }, async () => {
  const database = createPostgresDatabase({ connectionString: databaseUrl, ssl: false, applicationName: 'language-test' });
  await database.start();
  try {
    await runMigrations(database);
    const store = createPostgresLanguageStore({ database });
    const id = `language-test-${Date.now()}`;
    const written = await store.set(id, { language: 'uk', locale: 'uk-UA', source: 'test', provenance: { test: true } });
    assert.equal(written.language, 'uk');
    const read = await store.get(id);
    assert.equal(read.language, 'uk');
    assert.equal(read.locale, 'uk-UA');
    assert.equal(read.source, 'test');
    const row = await database.query('SELECT profile FROM users WHERE global_user_id=$1', [id]);
    assert.equal(row.rows[0].profile.languageSettings.language, 'uk');
  } finally {
    await database.close();
  }
});

test('Telegram adapter uses Telegram user language_code as platform locale hint', async () => {
  let seen = null;
  const adapter = createTelegramTransportAdapter({
    identityResolver: async () => ({
      identityContext: { globalUserId: 'g1', roles: ['guest'], grants: [], authenticationLevel: 'verified' },
      scopeContext: { userScope: 'g1', projectScope: 'sg2.1', allowedCapabilities: [] }
    }),
    requestHandler: async (input) => { seen = input; return { status: 'success', message: 'ok' }; },
    responseDeliverer: async () => {},
    idFactory: () => 'id'
  });
  await adapter.receive({
    update_id: 1,
    message: { message_id: 10, text: 'Привіт', from: { id: 7, language_code: 'uk' }, chat: { id: 7, type: 'private' } }
  });
  assert.equal(seen.locale, 'uk');
});
