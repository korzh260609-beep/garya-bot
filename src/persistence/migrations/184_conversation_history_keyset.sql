CREATE INDEX IF NOT EXISTS messages_history_scope_time_idx
  ON messages(global_user_id, project_scope, group_scope, thread_scope, created_at, message_id);
