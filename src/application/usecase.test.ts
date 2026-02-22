import { describe, it, expect, beforeEach } from "vitest";
import db from "../infrastructure/db/database";
import { assignTask, createTask, getTask, transitionTask } from "./usecase";
import { insertEvent } from "../infrastructure/repository";

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
		).toThrow("Version conflict");
	});
});

describe("transitionTask usecase (role-based rules)", () => {

	beforeEach(() => {
		db.exec(`
			DELETE FROM tasks;
			DELETE FROM idempotency_keys;
			DELETE FROM task_events;
		`);
	});

	it("agent can start task assigned to them (NEW -> IN_PROGRESS)", () => {
		const task = createTask({
			tenantId: "tenant_1",
			workspaceId: "workspace_1",
			idempotencyKey: null,
			role: "agent",
			title: "Agent Start",
			priority: "HIGH"
		});

		// assign dulu supaya agent boleh start
		db.prepare(`
			UPDATE tasks SET assignee_id = ?
			WHERE task_id = ?
		`).run("agent_1", task.task_id);

		const updated = transitionTask({
			tenantId: "tenant_1",
			workspaceId: "workspace_1",
			taskId: task.task_id,
			toState: "IN_PROGRESS",
			role: "agent",
			actorId: "agent_1",
			version: task.version
		});

		expect(updated.state).toBe("IN_PROGRESS");
	});

	it("agent cannot start task not assigned to them", () => {
		const task = createTask({
			tenantId: "tenant_1",
			workspaceId: "workspace_1",
			idempotencyKey: null,
			role: "agent",
			title: "Wrong Agent",
			priority: "HIGH"
		});

		db.prepare(`
			UPDATE tasks SET assignee_id = ?
			WHERE task_id = ?
		`).run("agent_2", task.task_id);

		expect(() =>
			transitionTask({
				tenantId: "tenant_1",
				workspaceId: "workspace_1",
				taskId: task.task_id,
				toState: "IN_PROGRESS",
				role: "agent",
				actorId: "agent_1",
				version: task.version
			})
		).toThrow();
	});

	it("agent cannot cancel task", () => {
		const task = createTask({
			tenantId: "tenant_1",
			workspaceId: "workspace_1",
			idempotencyKey: null,
			role: "agent",
			title: "Agent Cancel",
			priority: "LOW"
		});

		expect(() =>
			transitionTask({
				tenantId: "tenant_1",
				workspaceId: "workspace_1",
				taskId: task.task_id,
				toState: "CANCELLED",
				role: "agent",
				actorId: "agent_1",
				version: task.version
			})
		).toThrow();
	});

	it("manager can cancel task", () => {
		const task = createTask({
			tenantId: "tenant_1",
			workspaceId: "workspace_1",
			idempotencyKey: null,
			role: "agent",
			title: "Manager Cancel",
			priority: "LOW"
		});

		const updated = transitionTask({
			tenantId: "tenant_1",
			workspaceId: "workspace_1",
			taskId: task.task_id,
			toState: "CANCELLED",
			role: "manager",
			actorId: "manager_1",
			version: task.version
		});

		expect(updated.state).toBe("CANCELLED");
	});

	it("manager cannot move task to IN_PROGRESS", () => {
		const task = createTask({
			tenantId: "tenant_1",
			workspaceId: "workspace_1",
			idempotencyKey: null,
			role: "agent",
			title: "Manager Invalid",
			priority: "LOW"
		});

		expect(() =>
			transitionTask({
				tenantId: "tenant_1",
				workspaceId: "workspace_1",
				taskId: task.task_id,
				toState: "IN_PROGRESS",
				role: "manager",
				actorId: "manager_1",
				version: task.version
			})
		).toThrow();
	});

});

describe("getTask usecase", () => {
	const tenantId = "tenant_1";
	const workspaceId = "workspace_1";

	beforeEach(() => {
		db.exec(`
			DELETE FROM tasks;
			DELETE FROM idempotency_keys;
			DELETE FROM task_events;
		`);
	});

	it("should return task with one timeline", () => {
		const created = createTask({
			tenantId,
			workspaceId,
			idempotencyKey: null,
			role: "agent",
			title: "Test Task",
			priority: "HIGH",
		});

		const result = getTask({
			tenantId,
			workspaceId,
			taskId: created.task_id,
		});

		expect(result.task_id).toBe(created.task_id);
		expect(result.timeline).toBeDefined();
		expect(result.timeline.length).toBe(1);
	});

	it("should return task with timeline events", () => {
		const created = createTask({
			tenantId,
			workspaceId,
			idempotencyKey: null,
			role: "agent",
			title: "Task With Events",
			priority: "MEDIUM",
		});

		// insert 3 events
		for (let i = 0; i < 3; i++) {
			insertEvent(db, {
				tenantId,
				workspaceId,
				taskId: created.task_id,
				type: "TaskCreated",
				payload: JSON.stringify({ index: i }),
			});
		}

		const result = getTask({
			tenantId,
			workspaceId,
			taskId: created.task_id,
		});

		expect(result.timeline.length).toBe(4);

		// Pastikan DESC (event terbaru di index 0)
		const rowids = db.prepare(`
		      SELECT rowid FROM task_events
		      WHERE task_id = ?
		      ORDER BY rowid DESC
		`).all(created.task_id) as { rowid: number }[];

		expect(result.timeline[0].rowid).toBe(rowids[0].rowid);
	});

	it("should throw if task not found", () => {
		expect(() =>
			getTask({
				tenantId,
				workspaceId,
				taskId: "not-exist",
			})
		).toThrow("Task not found");
	});
});
