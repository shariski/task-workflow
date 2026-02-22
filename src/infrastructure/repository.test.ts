import { describe, beforeEach, expect } from "vitest";
import { insertTask, getTasks, findTaskById, updateTask, insertIdempotentKey, insertEvent } from "./repository";
import { v4 as uuidv4 } from "uuid";
import db from "./db/database"

describe("Repository", () => {
	beforeEach(() => {
		db.exec("DELETE FROM tasks");
	});

	it("should create a task", () => {
		const taskId = uuidv4();

		const task = insertTask({
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

		insertTask({
			taskId: taskId,
			tenantId: "tenant_001",
			workspaceId: "workspace_001",
			title: "Follow up events",
			priority: "HIGH",
			state: "NEW",
		});

		const result = findTaskById(taskId);

		expect(result).toBeDefined();
		expect(result.task_id).toBe(taskId);
	});

	it("should return all tasks", () => {
		insertTask({
			taskId: uuidv4(),
			tenantId: "tenant_001",
			workspaceId: "workspace_001",
			title: "Follow up events",
			priority: "HIGH",
			state: "NEW",
		});
		insertTask({
			taskId: uuidv4(),
			tenantId: "tenant_001",
			workspaceId: "workspace_001",
			title: "Follow up events",
			priority: "LOW",
			state: "NEW",
		});

		const tasks = getTasks();

		expect(tasks.length).toBe(2);
	});

	it("should update a task", () => {
		const taskId = uuidv4();
		insertTask({
			taskId: taskId,
			tenantId: "tenant_001",
			workspaceId: "workspace_001",
			title: "Follow up events",
			priority: "HIGH",
			state: "NEW",
		});

		const changes = updateTask(taskId, 1, "u_123", "IN_PROGRESS");

		expect(changes).toBeDefined();
		expect(changes).toBe(1);
	});

	it("should not update a task and return error", () => {
		const taskId = uuidv4();
		insertTask({
			taskId: taskId,
			tenantId: "tenant_001",
			workspaceId: "workspace_001",
			title: "Follow up events",
			priority: "HIGH",
			state: "NEW",
		});

		expect(() => updateTask(taskId, 1)).toThrow(
			"No fields provided to update"
		);
	});

	it("should not update a task", () => {
		const taskId = uuidv4();
		insertTask({
			taskId: taskId,
			tenantId: "tenant_001",
			workspaceId: "workspace_001",
			title: "Follow up events",
			priority: "HIGH",
			state: "NEW",
		});

		const changes = updateTask(taskId, 2, "u_123", "IN_PROGRESS");

		expect(changes).toBeDefined();
		expect(changes).toBe(0);
	});

	it("should create an idempotent key", () => {
		const tenantId = "tenant_001";
		const workspaceId = "workspace_001";
		const idempotentKey = uuidv4();
		const taskId = uuidv4();

		const result = insertIdempotentKey(tenantId, workspaceId, idempotentKey, taskId);

		expect(result).toBeDefined();
		expect(result.taskId).toBe(taskId);
	});

	it("should create an idempotent key for two same insert", () => {
		const tenantId = "tenant_001";
		const workspaceId = "workspace_001";
		const idempotentKey = uuidv4();
		const taskId = uuidv4();

		const result = insertIdempotentKey(tenantId, workspaceId, idempotentKey, taskId);

		expect(result).toBeDefined();
		expect(result.taskId).toBe(taskId);

		expect(() => insertIdempotentKey(tenantId, workspaceId, idempotentKey, taskId)).toThrowError(
			expect.objectContaining({
				code: "SQLITE_CONSTRAINT_PRIMARYKEY"
			})
		);
	});

	it("should create an event", () => {
		const taskId = uuidv4();
		const tenantId = "tenant_001";
		const workspaceId = "workspace_001";
		const type = "TaskCreated";
		const payload = JSON.stringify({});

		const result = insertEvent(tenantId, workspaceId, taskId, type, payload);

		expect(result).toBeDefined();
		expect(result.taskId).toBe(taskId);
	});
});
