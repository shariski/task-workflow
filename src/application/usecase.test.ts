import { describe, it, expect, beforeEach } from "vitest";
import db from "../infrastructure/db/database";
import { assignTask, createTask } from "./usecase";

describe("createTask usecase", () => {

	beforeEach(() => {
		db.exec(`
		      DELETE FROM tasks;
		      DELETE FROM idempotency_keys;
		      DELETE FROM task_events;
		`);
	});

	it("should create a new task without idempotency key", () => {
		const result = createTask({
			tenantId: "tenant_1",
			workspaceId: "workspace_1",
			idempotencyKey: null,
			role: "agent",
			title: "Test Task",
			priority: "HIGH"
		});

		expect(result).toBeDefined();
		expect(result.title).toBe("Test Task");
		expect(result.state).toBe("NEW");

		const tasks = db.prepare("SELECT * FROM tasks").all();
		expect(tasks.length).toBe(1);
	});

	it("should create a task and store idempotency key", () => {
		const result = createTask({
			tenantId: "tenant_1",
			workspaceId: "workspace_1",
			idempotencyKey: "abc-123",
			role: "agent",
			title: "Task With Idempotency",
			priority: "LOW"
		});

		expect(result).toBeDefined();

		const idempotencyRows = db
			.prepare("SELECT * FROM idempotency_keys")
			.all();

		expect(idempotencyRows.length).toBe(1);
	});

	it("should return existing task when idempotency key is reused", () => {
		const first = createTask({
			tenantId: "tenant_1",
			workspaceId: "workspace_1",
			idempotencyKey: "same-key",
			role: "agent",
			title: "Original Task",
			priority: "MEDIUM"
		});

		const second = createTask({
			tenantId: "tenant_1",
			workspaceId: "workspace_1",
			idempotencyKey: "same-key",
			role: "agent",
			title: "SHOULD NOT BE CREATED",
			priority: "HIGH"
		});

		const tasks = db.prepare("SELECT * FROM tasks").all();
		expect(second.task_id).toBe(first.task_id);

		expect(tasks.length).toBe(1);
	});
});

describe("assignTask usecase", () => {

	beforeEach(() => {
		db.exec(`
		      DELETE FROM tasks;
		      DELETE FROM idempotency_keys;
		      DELETE FROM task_events;
		`);
	});

	it("should assign task successfully", () => {
		const task = createTask({
			tenantId: "tenant_1",
			workspaceId: "workspace_1",
			idempotencyKey: null,
			role: "agent",
			title: "Assign Me",
			priority: "HIGH"
		});

		const updated = assignTask({
			tenantId: "tenant_1",
			workspaceId: "workspace_1",
			taskId: task.task_id,
			assigneeId: "user_1",
			version: task.version
		});

		expect(updated.assignee_id).toBe("user_1");
	});

	it("should throw if task not found", () => {
		expect(() =>
			assignTask({
				tenantId: "tenant_1",
				workspaceId: "workspace_1",
				taskId: "not-exist",
				assigneeId: "user_1",
				version: 1
			})
		).toThrow("Task not found");
	});

	it("should not assign if state is DONE", () => {
		const task = createTask({
			tenantId: "tenant_1",
			workspaceId: "workspace_1",
			idempotencyKey: null,
			role: "agent",
			title: "Done Task",
			priority: "LOW"
		});

		// force update state ke DONE langsung
		db.prepare(`
		      UPDATE tasks
		      SET state = 'DONE'
		      WHERE task_id = ?
	        `).run(task.task_id);

		expect(() =>
			assignTask({
				tenantId: "tenant_1",
				workspaceId: "workspace_1",
				taskId: task.task_id,
				assigneeId: "user_1",
				version: task.version
			})
		).toThrow("Task cannot be assigned");
	});

	it("should throw on version conflict", () => {
		const task = createTask({
			tenantId: "tenant_1",
			workspaceId: "workspace_1",
			idempotencyKey: null,
			role: "agent",
			title: "Version Test",
			priority: "LOW"
		});

		expect(() =>
			assignTask({
				tenantId: "tenant_1",
				workspaceId: "workspace_1",
				taskId: task.task_id,
				assigneeId: "user_1",
				version: 999 // wrong version
			})
		).toThrow("Update failed");
	});

});
