import Database from "better-sqlite3";
import { Transaction } from "../repository";

export class SQLiteTransaction implements Transaction {
	constructor(private db: Database.Database) { }

	runInTransaction<T>(fn: () => T): T {
		const trx = this.db.transaction(fn);

		return trx();
	}
}

