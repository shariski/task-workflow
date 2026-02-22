import Database from "better-sqlite3";
import { Priority, State, TaskProps } from "../domain/task";

type EventType = "TaskCreated" | "TaskAssigned" | "TaskStateChanged";

export interface CreateTaskDTO {
	tenantId: string;
	workspaceId: string;
	taskId: string;
	title: string;
	priority: Priority;
	state: State;
};

export interface FindTaskDTO {
	tenantId: string;
	workspaceId: string;
	taskId: string;
};

export interface UpdateTaskDTO {
	tenantId: string;
	workspaceId: string;
	taskId: string;
	version: number;
	assigneeId: string | null;
	state: State | null;
};

export interface InsertIdempotencyKeyDTO {
	tenantId: string;
	workspaceId: string;
	idempotencyKey: string;
	taskId: string;
};

export interface GetIdempotencyKeyDTO {
	tenantId: string;
	workspaceId: string;
	idempotencyKey: string;
};

export interface InsertEventDTO {
	tenantId: string;
	workspaceId: string;
	taskId: string;
	type: EventType;
	payload: string;
};

export interface FindEventsDTO {
	tenantId: string;
	workspaceId: string;
	taskId: string;
};

export const insertTask = (db: Database.Database, data: CreateTaskDTO) => {
	const stmt = db.prepare(`
		INSERT INTO tasks (task_id, tenant_id, workspace_id, title, priority, state, version)
		VALUES (@taskId, @tenantId, @workspaceId, @title, @priority, @state, @version)
	`);

	const result = stmt.run({
		taskId: data.taskId,
		tenantId: data.tenantId,
		workspaceId: data.workspaceId,
		title: data.title,
		priority: data.priority,
		state: data.state,
		version: 1,
	});

	return { id: result.lastInsertRowid, ...data };
};

export const findTask = (db: Database.Database, data: FindTaskDTO): TaskProps => {
	const stmt = db.prepare(`
		SELECT * FROM tasks
		WHERE tenant_id = @tenantId AND workspace_id = @workspaceId AND task_id = @taskId
	`);
	return stmt.get(data) as TaskProps;
};

export const getTasks = (db: Database.Database) => {
	const stmt = db.prepare(`SELECT * FROM tasks`);
	return stmt.all();
};

export const updateTask = (db: Database.Database, data: UpdateTaskDTO): number => {
	const updates: string[] = [];
	const params: Record<string, any> = { taskId: data.taskId };

	if (data.assigneeId !== null) {
		updates.push("assignee_id = @assigneeId");
		params.assigneeId = data.assigneeId;
	}

	if (data.state !== null) {
		updates.push("state = @state");
		params.state = data.state;
	}

	if (updates.length === 0) {
		throw new Error("No fields provided to update");
	}

	const query = `
		UPDATE tasks
		SET ${updates.join(", ")}, version = version + 1, updated_at = CURRENT_TIMESTAMP
		WHERE tenant_id = @tenantId AND workspace_id = @workspaceId AND task_id = @taskId AND version = @version
	`;

	params.tenantId = data.tenantId;
	params.workspaceId = data.workspaceId;
	params.version = data.version;

	const stmt = db.prepare(query);
	const result = stmt.run(params);

	return result.changes;
};

export const insertIdempotencyKey = (db: Database.Database, data: InsertIdempotencyKeyDTO) => {
	const stmt = db.prepare(`
		INSERT INTO idempotency_keys (tenant_id, workspace_id, idempotency_key, task_id)
		VALUES (@tenantId, @workspaceId, @idempotencyKey, @taskId)
	`);

	const result = stmt.run(data);

	return { id: result.lastInsertRowid, ...data };
};

export const getIdempotencyKey = (db: Database.Database, data: GetIdempotencyKeyDTO) => {
	const stmt = db.prepare(`
		SELECT task_id FROM idempotency_keys
		WHERE tenant_id = @tenantId AND workspace_id = @workspaceId AND idempotency_key = @idempotencyKey
	`)

	const result = stmt.get(data) as { task_id: string };

	return result;
};

export const insertEvent = (db: Database.Database, data: InsertEventDTO) => {
	const stmt = db.prepare(`
		INSERT INTO task_events (tenant_id, workspace_id, task_id, type, payload)
		VALUES (@tenantId, @workspaceId, @taskId, @type, @payload)
	`);

	const result = stmt.run(data);

	return { id: result.lastInsertRowid, ...data };
};

export const findEvents = (db: Database.Database, data: FindEventsDTO) => {
	const stmt = db.prepare(`
		SELECT rowid, * FROM task_events
		WHERE tenant_id = @tenantId AND workspace_id = @workspaceId AND task_id = @taskId
		ORDER BY created_at DESC, rowid DESC
		LIMIT 20
	`);

	const result = stmt.all(data);

	return result;
};
