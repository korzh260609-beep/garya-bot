/**
 * STAGE 7B.6 — retention-policy skeleton (disabled)
 * IMPORTANT:
 * - No deletion/archiving logic here.
 * - Pure config layer only.
 */

export const RETENTION_POLICY = {
  guest_retention_days: 7,
  citizen_retention_days: 30,
  monarch_retention_days: null, // unlimited
  ARCHIVE_ENABLED: false,
};
