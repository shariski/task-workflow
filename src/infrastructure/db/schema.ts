import Database from "better-sqlite3";

export function initSchema(db: Database.Database) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS tasks (
			task_id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			workspace_id TEXT NOT NULL,
			title TEXT NOT NULL,
			priority TEXT NOT NULL,
			state TEXT NOT NULL,
			assignee_id TEXT,
			version INTEGER NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		
		CREATE INDEX IF NOT EXISTS idx_tasks_workspace
		ON tasks (tenant_id, workspace_id);

		CREATE INDEX IF NOT EXISTS idx_tasks_filter
		ON tasks (tenant_id, workspace_id, state, assignee_id);

		CREATE TABLE IF NOT EXISTS task_events (
			event_id TEXT PRIMARY KEY,
			task_id TEXT NOT NULL,
			tenant_id TEXT NOT NULL,
			workspace_id TEXT NOT NULL,
			type TEXT NOT NULL,
			payload TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_task_events_task
		ON task_events (task_id, created_at DESC);
		
		CREATE TABLE IF NOT EXISTS idempotency_keys (
			tenant_id TEXT NOT NULL,
			workspace_id TEXT NOT NULL,
			idempotency_key TEXT NOT NULL,
			task_id TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (tenant_id, workspace_id, idempotency_key)
		);
	`);
}
