-- Memory 2.0 production policy: guests keep only session/conversation memory.
-- Automatic durable capture must fail closed for identities whose only project role is guest.
-- Manual Memory 2.0 capabilities are already absent from SAFE_GUEST_CAPABILITIES; this
-- database boundary closes the direct runtime auto-capture path as defense in depth.

CREATE OR REPLACE FUNCTION memory2_guest_autocapture_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.owner_global_user_id IS NOT NULL
     AND COALESCE(NEW.provenance->>'sourceType', '') = 'automatic-capture'
     AND EXISTS (
       SELECT 1 FROM roles
       WHERE global_user_id = NEW.owner_global_user_id
         AND project_scope = NEW.project_scope
         AND role = 'guest'
     )
     AND NOT EXISTS (
       SELECT 1 FROM roles
       WHERE global_user_id = NEW.owner_global_user_id
         AND project_scope = NEW.project_scope
         AND role <> 'guest'
     ) THEN
    RAISE EXCEPTION 'guest durable automatic memory is not permitted'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS memory2_z_guest_autocapture_guard_trigger ON memory_records;
CREATE TRIGGER memory2_z_guest_autocapture_guard_trigger
BEFORE INSERT OR UPDATE ON memory_records
FOR EACH ROW EXECUTE FUNCTION memory2_guest_autocapture_guard();