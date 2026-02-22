import db from "./db/database";

type TaskState = "NEW" | "IN_PROGRESS" | "DONE" | "CANCELLED";
type EventType = "TaskCreated" | "TaskAssigned" | "TaskStateChanged";

export interface CreateTaskDTO {
	taskId: string;
	tenantId: string;
	workspaceId: string;
	title: string;
	priority: "LOW" | "MEDIUM" | "HIGH";
	state: TaskState;
};

export interface TaskResult {
	task_id: string;
	tenant_id: string;
	workspace_id: string;
	title: string;
	priority: "LOW" | "MEDIUM" | "HIGH";
	state: TaskState;
	version: number;
	created_at: string;
	updated_at: string;
}

export const insertTask = (data: CreateTaskDTO) => {
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

export const findTaskById = (taskId: string): TaskResult => {
	const stmt = db.prepare(`SELECT * FROM tasks WHERE task_id = @taskId`);
	return stmt.get({ taskId: taskId }) as TaskResult;
};

export const getTasks = () => {
	const stmt = db.prepare(`SELECT * FROM tasks`);
	return stmt.all();
};

export const updateTask = (taskId: string, version: number, assigneeId?: string, state?: TaskState): number => {
	const updates: string[] = [];
	const params: Record<string, any> = { taskId };

	if (assigneeId !== undefined) {
		updates.push("assignee_id = @assigneeId");
		params.assigneeId = assigneeId;
	}

	if (state !== undefined) {
		updates.push("state = @state");
		params.state = state;
	}

	if (updates.length === 0) {
		throw new Error("No fields provided to update");
	}

	const query = `
		UPDATE tasks
		SET ${updates.join(", ")}, version = version + 1, updated_at = CURRENT_TIMESTAMP
		WHERE task_id = @taskId AND version = @version
	`;

	params.version = version;

	const stmt = db.prepare(query);
	const result = stmt.run(params);

	return result.changes;
};

export const insertIdempotentKey = (tenantId: string, workspaceId: string, key: string, taskId: string) => {
	const stmt = db.prepare(`
		INSERT INTO idempotency_keys (tenant_id, workspace_id, idempotency_key, task_id)
		VALUES (@tenantId, @workspaceId, @key, @taskId)
	`);

	const data = {
		tenantId,
		workspaceId,
		key,
		taskId
	};

	const result = stmt.run(data);

	return { id: result.lastInsertRowid, ...data };
};

export const insertEvent = (tenantId: string, workspaceId: string, taskId: string, type: EventType, payload: any) => {
	const stmt = db.prepare(`
		INSERT INTO task_events (tenant_id, workspace_id, task_id, type, payload)
		VALUES (@tenantId, @workspaceId, @taskId, @type, @payload)
	`);

	const data = {
		workspaceId,
		tenantId,
		taskId,
		type,
		payload
	};

	const result = stmt.run(data);

	return { id: result.lastInsertRowid, ...data };
};

