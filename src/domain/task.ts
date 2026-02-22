export type State =
	| "NEW"
	| "IN_PROGRESS"
	| "DONE"
	| "CANCELLED";

export type Role = "agent" | "manager";

export interface TaskProps {
	task_id: string;
	tenant_id: string;
	workspace_id: string;
	title: string;
	priority: "LOW" | "MEDIUM" | "HIGH";
	state: State;
	assignee_id: string | null;
	version: number;
	created_at: string;
	updated_at: string;
}

export class InvalidTransitionError extends Error { }
export class AuthorizationError extends Error { }

export class Task {
	constructor(private props: TaskProps) { }

	get snapshot() {
		return { ...this.props };
	}

	canBeAssigned() {
		return ["NEW", "IN_PROGRESS"].includes(this.props.state);
	}

	private static allowedTransitions: Record<State, State[]> = {
		NEW: ["IN_PROGRESS", "CANCELLED"],
		IN_PROGRESS: ["DONE", "CANCELLED"],
		DONE: [],
		CANCELLED: [],
	};

	transition(params: {
		toState: State;
		role: Role;
		actorId: string;
	}) {
		const { toState, role, actorId } = params;

		const current = this.props.state;

		if (!Task.allowedTransitions[current].includes(toState)) {
			throw new InvalidTransitionError(`Cannot transition from ${current} to ${toState}`);
		}

		// 2️⃣ Role rules
		if (role === "agent") {
			if (current === "NEW" && toState === "IN_PROGRESS") {
				if (this.props.assignee_id !== actorId) {
					throw new AuthorizationError("Agent can only start tasks assigned to them");
				}
			}

			if (current === "IN_PROGRESS" && toState === "DONE") {
				if (this.props.assignee_id !== actorId) {
					throw new AuthorizationError("Agent can only complete tasks assigned to them");
				}
			}

			if (toState === "CANCELLED") {
				throw new AuthorizationError("Agent cannot cancel tasks");
			}
		}

		if (role === "manager") {
			if (toState !== "CANCELLED") {
				throw new AuthorizationError("Manager can only cancel tasks");
			}
		}

		return toState;
	}
}
