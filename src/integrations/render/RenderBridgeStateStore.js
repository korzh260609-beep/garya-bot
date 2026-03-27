// src/integrations/render/RenderBridgeStateStore.js

import pool from "../../../db.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

class RenderBridgeStateStore {
  constructor({ dbPool } = {}) {
    this.pool = dbPool || pool;
    this.schemaReadyPromise = null;
  }

  async ensureSchema() {
    if (this.schemaReadyPromise) {
      return this.schemaReadyPromise;
    }

    this.schemaReadyPromise = (async () => {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS render_bridge_state (
          id BIGSERIAL PRIMARY KEY,
          owner_key TEXT NOT NULL UNIQUE,
          selected_service_id TEXT,
          selected_service_name TEXT,
          selected_service_slug TEXT,
          selected_owner_id TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await this.pool.query(`
        ALTER TABLE render_bridge_state
        ADD COLUMN IF NOT EXISTS selected_owner_id TEXT;
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_render_bridge_state_owner
        ON render_bridge_state (owner_key);
      `);
    })();

    try {
      await this.schemaReadyPromise;
    } catch (error) {
      this.schemaReadyPromise = null;
      throw error;
    }

    return this.schemaReadyPromise;
  }

  async getState(ownerKey = "global") {
    await this.ensureSchema();

    const normalizedOwnerKey = normalizeString(ownerKey) || "global";

    const res = await this.pool.query(
      `
      SELECT
        owner_key,
        selected_service_id,
        selected_service_name,
        selected_service_slug,
        selected_owner_id,
        updated_at
      FROM render_bridge_state
      WHERE owner_key = $1
      LIMIT 1
      `,
      [normalizedOwnerKey]
    );

    return res?.rows?.[0] || null;
  }

  async setSelectedService({
    ownerKey = "global",
    serviceId = null,
    serviceName = null,
    serviceSlug = null,
    ownerId = null,
  }) {
    await this.ensureSchema();

    const normalizedOwnerKey = normalizeString(ownerKey) || "global";

    const res = await this.pool.query(
      `
      INSERT INTO render_bridge_state (
        owner_key,
        selected_service_id,
        selected_service_name,
        selected_service_slug,
        selected_owner_id,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (owner_key)
      DO UPDATE SET
        selected_service_id = EXCLUDED.selected_service_id,
        selected_service_name = EXCLUDED.selected_service_name,
        selected_service_slug = EXCLUDED.selected_service_slug,
        selected_owner_id = EXCLUDED.selected_owner_id,
        updated_at = NOW()
      RETURNING
        owner_key,
        selected_service_id,
        selected_service_name,
        selected_service_slug,
        selected_owner_id,
        updated_at
      `,
      [
        normalizedOwnerKey,
        serviceId ? normalizeString(serviceId) : null,
        serviceName ? normalizeString(serviceName) : null,
        serviceSlug ? normalizeString(serviceSlug) : null,
        ownerId ? normalizeString(ownerId) : null,
      ]
    );

    return res?.rows?.[0] || null;
  }

  async clearSelectedService(ownerKey = "global") {
    await this.ensureSchema();

    const normalizedOwnerKey = normalizeString(ownerKey) || "global";

    const res = await this.pool.query(
      `
      INSERT INTO render_bridge_state (
        owner_key,
        selected_service_id,
        selected_service_name,
        selected_service_slug,
        selected_owner_id,
        updated_at
      )
      VALUES ($1, NULL, NULL, NULL, NULL, NOW())
      ON CONFLICT (owner_key)
      DO UPDATE SET
        selected_service_id = NULL,
        selected_service_name = NULL,
        selected_service_slug = NULL,
        selected_owner_id = NULL,
        updated_at = NOW()
      RETURNING
        owner_key,
        selected_service_id,
        selected_service_name,
        selected_service_slug,
        selected_owner_id,
        updated_at
      `,
      [normalizedOwnerKey]
    );

    return res?.rows?.[0] || null;
  }
}

export const renderBridgeStateStore = new RenderBridgeStateStore();

export default renderBridgeStateStore;