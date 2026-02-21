import express, { Request, Response } from "express";

const app = express();
const PORT = 3000;

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
	res.json({ message: "Hello world" });
});

app.listen(PORT, () => {
	console.log(`Server running on port: ${PORT}`);
})
