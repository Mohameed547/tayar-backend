import express from "express";
import cors from "cors";
import router from "./routes/index.js";
import { errorHandler } from "./shared/middleware/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/", router);

app.use((req, res) => {
    res.status(404).json({
        status: "fail",
        message: `Route ${req.originalUrl} not found`,
    });
});

app.use(errorHandler);

export default app;
