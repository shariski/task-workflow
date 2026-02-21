import db from "./db/database";

export interface CreateUserDTO {
	name: string;
	email: string;
}

export const createUser = (data: CreateUserDTO) => {
	const stmt = db.prepare(`
		INSERT INTO users (name, email)
		VALUES (?, ?)
	`);

	const result = stmt.run(data.name, data.email);

	return { id: result.lastInsertRowid, ...data };
};

export const getUsers = () => {
	const stmt = db.prepare(`SELECT * FROM users`);
	return stmt.all();
};
