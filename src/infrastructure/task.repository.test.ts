import { describe, beforeEach, expect } from "vitest";
import { createUser, getUsers } from "./task.repository";
import db from "./db/database"

describe("Task Repository", () => {
	beforeEach(() => {
		db.exec("DELETE FROM users");
	});

	it("should create a user", () => {
		const user = createUser({
			name: "Falah",
			email: "falah@test.com"
		});

		expect(user.id).toBeDefined();
		expect(user.name).toBe("Falah");
	});

	it("should return all users", () => {
		createUser({ name: "A", email: "a@test.com" });
		createUser({ name: "B", email: "b@test.com" });

		const users = getUsers();

		expect(users.length).toBe(2);
	});
});
