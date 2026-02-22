import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import { initSchema } from "./schema";

const isTest = process.env.NODE_ENV === "test";

const dbPath = isTest ? ":memory:" : path.join(__dirname, "../../../data/database.db");

if (!isTest) {
	fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);

initSchema(db);

export default db;
