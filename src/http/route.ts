import express from "express";
import {
	createTaskController,
	assignTaskController,
	transitionTaskController,
	getTaskController,
	getTasksController,
	getEventsController,
} from "./controller";

const router = express.Router();

router.post("/v1/workspaces/:workspaceId/tasks", createTaskController);
router.post("/v1/workspaces/:workspaceId/tasks/:taskId/assign", assignTaskController);
router.post("/v1/workspaces/:workspaceId/tasks/:taskId/transition", transitionTaskController);
router.get("/v1/workspaces/:workspaceId/tasks/:taskId", getTaskController);
router.get("/v1/workspaces/:workspaceId/tasks", getTasksController);
router.get("/v1/events", getEventsController);

export default router;
