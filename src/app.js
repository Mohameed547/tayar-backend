import express from "express";
import cors from "cors";
import router from "./routes/index.js";
import errorHandler from "./shared/middleware/errorHandler.js";

const app = express();

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "*",
    credentials: true,
  }),
);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", message: "Server is running" });
});

// Routes
app.use("/api", router);

// Global Error Handler
app.use(errorHandler);

export default app;
