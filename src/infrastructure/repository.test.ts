import { describe, beforeEach, expect } from "vitest";
import { insertTask, getTasks, findTask, updateTask, insertIdempotencyKey, insertEvent, getIdempotencyKey } from "./repository";
import { v4 as uuidv4 } from "uuid";
import db from "./db/database"

describe("Repository", () => {
	beforeEach(() => {
		db.exec("DELETE FROM tasks");
	});

	it("should create a task", () => {
		const taskId = uuidv4();

		const task = insertTask(db, {
			taskId: taskId,
			tenantId: "tenant_001",
			workspaceId: "workspace_001",
			title: "Follow up events",
			priority: "HIGH",
			state: "NEW",
		});

		expect(task.id).toBeDefined();
		expect(task.taskId).toBe(taskId);
	});

	it("should get a task", () => {
		const taskId = uuidv4();

		insertTask(db, {
			taskId: taskId,
			tenantId: "tenant_001",
			workspaceId: "workspace_001",
			title: "Follow up events",
			priority: "HIGH",
			state: "NEW",
		});

		const result = findTask(db, {
			taskId: taskId
		});

		expect(result).toBeDefined();
		expect(result.task_id).toBe(taskId);
	});

	it("should return all tasks", () => {
		insertTask(db, {
			taskId: uuidv4(),
			tenantId: "tenant_001",
			workspaceId: "workspace_001",
			title: "Follow up events",
			priority: "HIGH",
			state: "NEW",
		});
		insertTask(db, {
			taskId: uuidv4(),
			tenantId: "tenant_001",
			workspaceId: "workspace_001",
			title: "Follow up events",
			priority: "LOW",
			state: "NEW",
		});

		const tasks = getTasks(db);

		expect(tasks.length).toBe(2);
	});

	it("should update a task", () => {
		const taskId = uuidv4();
		insertTask(db, {
			taskId: taskId,
			tenantId: "tenant_001",
			workspaceId: "workspace_001",
			title: "Follow up events",
			priority: "HIGH",
			state: "NEW",
		});

		const changes = updateTask(db, {
			taskId: taskId,
			version: 1,
			assigneeId: "u_123",
			state: "IN_PROGRESS"
		});

		expect(changes).toBeDefined();
		expect(changes).toBe(1);
	});

	it("should not update a task and return error", () => {
		const taskId = uuidv4();
		insertTask(db, {
			taskId: taskId,
			tenantId: "tenant_001",
			workspaceId: "workspace_001",
			title: "Follow up events",
			priority: "HIGH",
			state: "NEW",
		});

		expect(() => updateTask(db, {
			taskId: taskId,
			version: 1,
			assigneeId: null,
			state: null
		})).toThrow(
			"No fields provided to update"
		);
	});

	it("should not update a task, version not match", () => {
		const taskId = uuidv4();
		insertTask(db, {
			taskId: taskId,
			tenantId: "tenant_001",
			workspaceId: "workspace_001",
			title: "Follow up events",
			priority: "HIGH",
			state: "NEW",
		});

		const changes = updateTask(db, {
			taskId: taskId,
			version: 2,
			assigneeId: "u_123",
			state: "IN_PROGRESS"
		});

		expect(changes).toBeDefined();
		expect(changes).toBe(0);
	});

	it("should create an idempotent key", () => {
		const tenantId = "tenant_001";
		const workspaceId = "workspace_001";
		const idempotentKey = uuidv4();
		const taskId = uuidv4();

		const result = insertIdempotencyKey(db, {
			tenantId: tenantId,
			workspaceId: workspaceId,
			idempotencyKey: idempotentKey,
			taskId: taskId
		});

		expect(result).toBeDefined();
		expect(result.taskId).toBe(taskId);
	});

	it("should create one idempotent key for two same inserts", () => {
		const tenantId = "tenant_001";
		const workspaceId = "workspace_001";
		const idempotentKey = uuidv4();
		const taskId = uuidv4();

		const result = insertIdempotencyKey(db, {
			tenantId: tenantId,
			workspaceId: workspaceId,
			idempotencyKey: idempotentKey,
			taskId: taskId
		});

		expect(result).toBeDefined();
		expect(result.taskId).toBe(taskId);

		expect(() => insertIdempotencyKey(db, {
			tenantId: tenantId,
			workspaceId: workspaceId,
			idempotencyKey: idempotentKey,
			taskId: taskId
		})).toThrowError(
			expect.objectContaining({
				code: "SQLITE_CONSTRAINT_PRIMARYKEY"
			})
		);
	});

	it("should get an idempotent key", () => {
		const tenantId = "tenant_001";
		const workspaceId = "workspace_001";
		const idempotentKey = uuidv4();
		const taskId = uuidv4();

		insertIdempotencyKey(db, {
			tenantId: tenantId,
			workspaceId: workspaceId,
			idempotencyKey: idempotentKey,
			taskId: taskId
		});

		const result = getIdempotencyKey(db, {
			tenantId: tenantId,
			workspaceId: workspaceId,
			idempotencyKey: idempotentKey
		});

		expect(result).toBeDefined();
		expect(result.task_id).toBe(taskId);
	});

	it("should not found idempotent key", () => {
		const tenantId = "tenant_001";
		const workspaceId = "workspace_001";
		const idempotentKey = uuidv4();

		const result = getIdempotencyKey(db, {
			tenantId: tenantId,
			workspaceId: workspaceId,
			idempotencyKey: idempotentKey
		});

		expect(result).toBeUndefined();
	});

	it("should create an event", () => {
		const taskId = uuidv4();
		const tenantId = "tenant_001";
		const workspaceId = "workspace_001";
		const type = "TaskCreated";
		const payload = JSON.stringify({});

		const result = insertEvent(db, {
			tenantId: tenantId,
			workspaceId: workspaceId,
			taskId: taskId,
			type: type,
			payload: payload
		});

		expect(result).toBeDefined();
		expect(result.taskId).toBe(taskId);
	});
});
