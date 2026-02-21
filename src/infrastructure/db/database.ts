import path from "path";
import fs from "fs";
import Database from "better-sqlite3";

const isTest = process.env.NODE_ENV === "test";

const dbPath = isTest ? ":memory" : path.join(__dirname, "../../../data/database.db");

if (!isTest) {
	fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);

db.exec(`
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		email TEXT UNIQUE NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
`);

export default db;
