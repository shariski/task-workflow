import { Request, Response } from "express";
import {
	createTask,
	assignTask,
	transitionTask,
	getTask,
	getTasks,
	getEvents,
} from "../application/usecase";
import { Priority, State } from "../domain/task";

function handleError(res: Response, err: any) {
	if (err.message === "Task not found") {
		return res.status(404).json({ error: err.message });
	}

	if (err.message.includes("status-409")) {
		return res.status(409).json({ error: err.message });
	}

	return res.status(400).json({ error: err.message });
}

type TaskParams = {
	workspaceId: string;
	taskId: string;
};

export const createTaskController = (req: Request<TaskParams>, res: Response) => {
	try {
		const tenantId = req.header("X-Tenant-Id");
		const role = req.header("X-Role") as "agent" | "manager";
		const idempotencyKey = req.header("Idempotency-Key") ?? null;

		if (!tenantId || !role) {
			return res.status(400).json({ error: "Missing headers" });
		}

		const { title, priority } = req.body;

		if (!title) {
			return res.status(400).json({ error: "Title is required" });
		}

		const result = createTask({
			tenantId,
			workspaceId: req.params.workspaceId,
			idempotencyKey,
			role,
			title,
			priority: (priority ?? "MEDIUM") as Priority,
		});

		res.status(201).json(result);
	} catch (err) {
		handleError(res, err);
	}
};

export const assignTaskController = (req: Request<TaskParams>, res: Response) => {
	try {
		const tenantId = req.header("X-Tenant-Id");
		const role = req.header("X-Header");
		const version = Number(req.header("If-Match-Version"));

		if (!tenantId || isNaN(version)) {
			return res.status(400).json({ error: "Missing headers" });
		}

		if (role !== "manager") {
			return res.status(409).json({ error: "Only manager can assign task" });
		}

		const { assignee_id } = req.body;

		const result = assignTask({
			tenantId,
			workspaceId: req.params.workspaceId,
			taskId: req.params.taskId,
			assigneeId: assignee_id,
			version,
		});

		res.json(result);
	} catch (err) {
		handleError(res, err);
	}
};

export const transitionTaskController = (req: Request<TaskParams>, res: Response) => {
	try {
		const tenantId = req.header("X-Tenant-Id");
		const role = req.header("X-Role") as "agent" | "manager";
		const actorId = req.header("X-User-Id");
		const version = Number(req.header("If-Match-Version"));

		if (!tenantId || !role || !actorId || isNaN(version)) {
			return res.status(400).json({ error: "Missing headers" });
		}

		const { to_state } = req.body;

		const result = transitionTask({
			tenantId,
			workspaceId: req.params.workspaceId,
			taskId: req.params.taskId,
			role,
			actorId,
			toState: to_state as State,
			version,
		});

		res.json(result);
	} catch (err) {
		handleError(res, err);
	}
};

export const getTaskController = (req: Request<TaskParams>, res: Response) => {
	try {
		const tenantId = req.header("X-Tenant-Id");

		if (!tenantId) {
			return res.status(400).json({ error: "Missing tenant header" });
		}

		const result = getTask({
			tenantId,
			workspaceId: req.params.workspaceId,
			taskId: req.params.taskId,
		});

		res.json(result);
	} catch (err) {
		handleError(res, err);
	}
};

export const getTasksController = (req: Request<TaskParams>, res: Response) => {
	try {
		const tenantId = req.header("X-Tenant-Id");

		if (!tenantId) {
			return res.status(400).json({ error: "Missing tenant header" });
		}

		const { state, assignee_id, limit = "20", cursor } = req.query;

		const result = getTasks({
			tenantId,
			workspaceId: req.params.workspaceId,
			state: state as State | undefined,
			assigneeId: assignee_id as string | undefined,
			limit: Number(limit),
			cursor: cursor as string,
		});

		res.json(result);
	} catch (err) {
		handleError(res, err);
	}
};

export const getEventsController = (req: Request, res: Response) => {
	try {
		const rawLimit = req.query.limit;

		let limit = 50; // default

		if (typeof rawLimit === "string") {
			const parsed = Number(rawLimit);

			if (!Number.isNaN(parsed) && parsed > 0) {
				limit = parsed;
			}
		}

		const result = getEvents({ limit });

		res.json(result);
	} catch (err) {
		handleError(res, err);
	}
};

