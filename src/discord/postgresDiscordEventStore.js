function requiredEventId(value) {
  const id = String(value ?? '').trim();
  if (!/^\d{15,22}$/.test(id)) throw new TypeError('discord event id must be a Discord snowflake');
  return id;
}

function eventType(event) {
  return String(event?.type ?? event?.eventType ?? 'MESSAGE_CREATE').slice(0, 80);
}

export function createPostgresDiscordEventStore(database) {
  if (!database || typeof database.query !== 'function') throw new TypeError('database.query is required');

  async function claim(event) {
    const eventId = requiredEventId(event?.id);
    const result = await database.query(`
      INSERT INTO discord_events(event_id, event_type, guild_id, channel_id, user_id, status)
      VALUES ($1, $2, $3, $4, $5, 'processing')
      ON CONFLICT (event_id) DO NOTHING
      RETURNING event_id
    `, [
      eventId,
      eventType(event),
      event?.guild_id == null ? null : String(event.guild_id),
      event?.channel_id == null ? null : String(event.channel_id),
      event?.author?.id == null ? null : String(event.author.id)
    ]);
    return Object.freeze({ claimed: result.rowCount === 1, eventId });
  }

  async function complete(eventId, status = 'completed') {
    if (!['completed', 'ignored'].includes(status)) throw new TypeError('invalid Discord completion status');
    await database.query(`
      UPDATE discord_events
      SET status = $2, completed_at = now(), failure_code = NULL
      WHERE event_id = $1
    `, [requiredEventId(eventId), status]);
  }

  async function fail(eventId, failureCode = 'discord-event-failed') {
    await database.query(`
      UPDATE discord_events
      SET status = 'failed', completed_at = now(), failure_code = $2
      WHERE event_id = $1
    `, [requiredEventId(eventId), String(failureCode).slice(0, 120)]);
  }

  return Object.freeze({ claim, complete, fail });
}
