import express from "express";
import router from "./routes/index.js";
import errorHandler from "./shared/middleware/errorHandler.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

app.use("/api", router);
app.use(errorHandler);

export default app;
