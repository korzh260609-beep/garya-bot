// migrations/023_backfill_chat_messages_global_user_id.js
// STAGE 8 — Recall backfill support
// Goal: fill chat_messages.global_user_id for old rows using user_links/user_identities.
// SAFE: dynamic column detection, fail-open, idempotent.

export async function up(pgm) {
  pgm.sql(`
DO $$
DECLARE
  has_chat_messages boolean;
  has_global_user_id boolean;

  -- candidate columns inside chat_messages
  has_sender_id boolean;
  has_provider_user_id boolean;
  has_user_id boolean;
  has_tg_user_id boolean;

  updated_count bigint;
BEGIN
  has_chat_messages := to_regclass('public.chat_messages') IS NOT NULL;
  IF NOT has_chat_messages THEN
    RAISE NOTICE 'chat_messages not found, skipping';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='chat_messages' AND column_name='global_user_id'
  ) INTO has_global_user_id;

  IF NOT has_global_user_id THEN
    RAISE NOTICE 'chat_messages.global_user_id not found, skipping';
    RETURN;
  END IF;

  -- detect likely sender column names (we try several common variants)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='chat_messages' AND column_name='sender_id'
  ) INTO has_sender_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='chat_messages' AND column_name='provider_user_id'
  ) INTO has_provider_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='chat_messages' AND column_name='user_id'
  ) INTO has_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='chat_messages' AND column_name='tg_user_id'
  ) INTO has_tg_user_id;

  -- 1) Best case: chat_messages has sender_id -> map via user_links(provider='telegram')
  IF has_sender_id THEN
    EXECUTE $SQL$
      UPDATE chat_messages cm
      SET global_user_id = ul.global_user_id
      FROM user_links ul
      WHERE cm.global_user_id IS NULL
        AND ul.provider = 'telegram'
        AND ul.provider_user_id = cm.sender_id::text
        AND ul.global_user_id IS NOT NULL
    $SQL$;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'backfill via sender_id->user_links updated % rows', updated_count;
  END IF;

  -- 2) Alternative: provider_user_id column name
  IF has_provider_user_id THEN
    EXECUTE $SQL$
      UPDATE chat_messages cm
      SET global_user_id = ul.global_user_id
      FROM user_links ul
      WHERE cm.global_user_id IS NULL
        AND ul.provider = 'telegram'
        AND ul.provider_user_id = cm.provider_user_id::text
        AND ul.global_user_id IS NOT NULL
    $SQL$;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'backfill via provider_user_id->user_links updated % rows', updated_count;
  END IF;

  -- 3) Alternative: tg_user_id column name
  IF has_tg_user_id THEN
    EXECUTE $SQL$
      UPDATE chat_messages cm
      SET global_user_id = ul.global_user_id
      FROM user_links ul
      WHERE cm.global_user_id IS NULL
        AND ul.provider = 'telegram'
        AND ul.provider_user_id = cm.tg_user_id::text
        AND ul.global_user_id IS NOT NULL
    $SQL$;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'backfill via tg_user_id->user_links updated % rows', updated_count;
  END IF;

  -- 4) Fallback mapping via user_identities if it exists (same provider/provider_user_id model)
  IF to_regclass('public.user_identities') IS NOT NULL THEN
    -- try sender_id
    IF has_sender_id THEN
      EXECUTE $SQL$
        UPDATE chat_messages cm
        SET global_user_id = ui.global_user_id
        FROM user_identities ui
        WHERE cm.global_user_id IS NULL
          AND ui.provider = 'telegram'
          AND ui.provider_user_id = cm.sender_id::text
          AND ui.global_user_id IS NOT NULL
      $SQL$;

      GET DIAGNOSTICS updated_count = ROW_COUNT;
      RAISE NOTICE 'backfill via sender_id->user_identities updated % rows', updated_count;
    END IF;

    -- try provider_user_id
    IF has_provider_user_id THEN
      EXECUTE $SQL$
        UPDATE chat_messages cm
        SET global_user_id = ui.global_user_id
        FROM user_identities ui
        WHERE cm.global_user_id IS NULL
          AND ui.provider = 'telegram'
          AND ui.provider_user_id = cm.provider_user_id::text
          AND ui.global_user_id IS NOT NULL
      $SQL$;

      GET DIAGNOSTICS updated_count = ROW_COUNT;
      RAISE NOTICE 'backfill via provider_user_id->user_identities updated % rows', updated_count;
    END IF;
  END IF;

  -- optional schema_version bump (idempotent)
  IF to_regclass('public.schema_version') IS NOT NULL THEN
    INSERT INTO schema_version (version, note)
    VALUES (23, 'stage 8 backfill chat_messages.global_user_id (safe dynamic)')
    ON CONFLICT (version) DO NOTHING;
  END IF;

END $$;
  `);
}

export async function down() {
  // forward-only policy; keep down minimal
}
