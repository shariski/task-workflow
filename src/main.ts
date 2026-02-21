import express, { Request, Response } from "express";
import { createUser, getUsers } from "./infrastructure/task.repository";

const app = express();
const PORT = 3000;

app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
	res.json({ message: "Hello world" });
});

app.post("/users", (req: Request, res: Response) => {
	try {
		const user = createUser(req.body);
		res.status(201).json(user);
	} catch (err: any) {
		res.status(400).json({ error: err.message });
	}
});

app.get("/users", (_req: Request, res: Response) => {
	const users = getUsers();
	res.json(users);
});

app.listen(PORT, () => {
	console.log(`Server running on port: ${PORT}`);
})
