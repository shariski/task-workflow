import { Priority } from "../domain/task";
import db from "../infrastructure/db/database";

export interface CreateTaskRequest {
	tenantId: string;
	workspaceId: string;
	idempotencyKey: string | null;
	role: "agent" | "manager";
	title: string;
	priority: Priority;
};

export const createTask = (data: CreateTaskRequest) => {
	const tx = db.transaction(() => {
	})
};
