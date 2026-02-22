import { Priority, State, Task } from "../domain/task";
import db from "../infrastructure/db/database";
import { findTask, getIdempotencyKey, insertEvent, insertIdempotencyKey, insertTask, updateTask } from "../infrastructure/repository";
import { v4 as uuidv4 } from "uuid";

export interface CreateTaskRequest {
	tenantId: string;
	workspaceId: string;
	idempotencyKey: string | null;
	role: "agent" | "manager";
	title: string;
	priority: Priority;
};

export interface AssignTaskRequest {
	tenantId: string;
	workspaceId: string;
	taskId: string;
	assigneeId: string;
	version: number;
};

export interface TransitionTaskRequest {
	tenantId: string;
	workspaceId: string;
	taskId: string;
	role: "agent" | "manager";
	actorId: string;
	toState: State;
	version: number;
};

export const createTask = (data: CreateTaskRequest) => {
	const tx = db.transaction(() => {
		const taskId = uuidv4();

		if (data.idempotencyKey !== null) {
			try {
				insertIdempotencyKey(db, {
					tenantId: data.tenantId,
					workspaceId: data.workspaceId,
					idempotencyKey: data.idempotencyKey,
					taskId: taskId
				});
			} catch (err: any) {
				if (err.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
					const existing = getIdempotencyKey(db, {
						tenantId: data.tenantId,
						workspaceId: data.workspaceId,
						idempotencyKey: data.idempotencyKey
					});
					return findTask(db, { tenantId: data.tenantId, workspaceId: data.workspaceId, taskId: existing.task_id });
				}
				throw err;
			}
		}

		insertTask(db, {
			taskId: taskId,
			tenantId: data.tenantId,
			workspaceId: data.workspaceId,
			title: data.title,
			priority: data.priority,
			state: "NEW"
		});

		insertEvent(db, {
			tenantId: data.tenantId,
			workspaceId: data.workspaceId,
			taskId: taskId,
			type: "TaskCreated",
			payload: JSON.stringify({})
		});

		return findTask(db, { tenantId: data.tenantId, workspaceId: data.workspaceId, taskId });
	});

	return tx();
};

export const assignTask = (data: AssignTaskRequest) => {
	const tx = db.transaction(() => {
		const taskRecord = findTask(db, { tenantId: data.tenantId, workspaceId: data.workspaceId, taskId: data.taskId });

		if (!taskRecord) {
			throw new Error("Task not found");
		}

		const task = new Task(taskRecord);

		if (!task.canBeAssigned()) {
			throw new Error(`Task cannot be assigned, status: ${task.getState()}`)
		}

		const changes = updateTask(db, {
			tenantId: data.tenantId,
			workspaceId: data.workspaceId,
			taskId: data.taskId,
			assigneeId: data.assigneeId,
			state: null,
			version: data.version
		});

		if (changes === 0) {
			throw new Error("Version conflict");
		}

		return findTask(db, { tenantId: data.tenantId, workspaceId: data.workspaceId, taskId: data.taskId });
	});

	return tx();
};

export const transitionTask = (data: TransitionTaskRequest) => {
	const tx = db.transaction(() => {
		const taskRecord = findTask(db, { tenantId: data.tenantId, workspaceId: data.workspaceId, taskId: data.taskId });

		if (!taskRecord) {
			throw new Error("Task not found");
		}

		const task = new Task(taskRecord);

		// validate first
		task.transition({ toState: data.toState, role: data.role, actorId: data.actorId });

		const changes = updateTask(db, {
			tenantId: data.tenantId,
			workspaceId: data.workspaceId,
			taskId: data.taskId,
			assigneeId: null,
			state: data.toState,
			version: data.version
		});

		if (changes === 0) {
			throw new Error("Version conflict");
		}

		return findTask(db, { tenantId: data.tenantId, workspaceId: data.workspaceId, taskId: data.taskId });
	});

	return tx();
};
