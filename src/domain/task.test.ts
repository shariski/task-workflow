import { describe, it, expect } from "vitest";
import {
	Task,
	InvalidTransitionError,
	AuthorizationError,
	TaskProps,
} from "./task";

function createTask(overrides?: Partial<TaskProps>) {
	const base: TaskProps = {
		task_id: "t_1",
		tenant_id: "tenant_1",
		workspace_id: "ws_1",
		title: "Test Task",
		priority: "MEDIUM",
		state: "NEW",
		assignee_id: "u_1",
		version: 1,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	};

	return new Task({ ...base, ...overrides });
}

describe("Task Entity - State Machine", () => {
	it("should allow NEW → IN_PROGRESS for assigned agent", () => {
		const task = createTask({ state: "NEW", assignee_id: "u_1" });

		const next = task.transition({
			toState: "IN_PROGRESS",
			role: "agent",
			actorId: "u_1",
		});

		expect(next).toBe("IN_PROGRESS");
	});

	it("should reject NEW → IN_PROGRESS if agent not assigned", () => {
		const task = createTask({ state: "NEW", assignee_id: "u_1" });

		expect(() =>
			task.transition({
				toState: "IN_PROGRESS",
				role: "agent",
				actorId: "u_2",
			})
		).toThrow(AuthorizationError);
	});

	it("should allow IN_PROGRESS → DONE for assigned agent", () => {
		const task = createTask({
			state: "IN_PROGRESS",
			assignee_id: "u_1",
		});

		const next = task.transition({
			toState: "DONE",
			role: "agent",
			actorId: "u_1",
		});

		expect(next).toBe("DONE");
	});

	it("should reject agent completing unassigned task", () => {
		const task = createTask({
			state: "IN_PROGRESS",
			assignee_id: "u_1",
		});

		expect(() =>
			task.transition({
				toState: "DONE",
				role: "agent",
				actorId: "u_2",
			})
		).toThrow(AuthorizationError);
	});

	it("should reject invalid transition NEW → DONE", () => {
		const task = createTask({ state: "NEW" });

		expect(() =>
			task.transition({
				toState: "DONE",
				role: "agent",
				actorId: "u_1",
			})
		).toThrow(InvalidTransitionError);
	});

	it("should allow manager to cancel NEW task", () => {
		const task = createTask({ state: "NEW" });

		const next = task.transition({
			toState: "CANCELLED",
			role: "manager",
			actorId: "manager_1",
		});

		expect(next).toBe("CANCELLED");
	});

	it("should reject manager trying to complete task", () => {
		const task = createTask({
			state: "IN_PROGRESS",
		});

		expect(() =>
			task.transition({
				toState: "DONE",
				role: "manager",
				actorId: "manager_1",
			})
		).toThrow(AuthorizationError);
	});

	it("should reject transition from DONE", () => {
		const task = createTask({ state: "DONE" });

		expect(() =>
			task.transition({
				toState: "IN_PROGRESS",
				role: "agent",
				actorId: "u_1",
			})
		).toThrow(InvalidTransitionError);
	});
});


