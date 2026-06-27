import express from "express";
import router from "./routes/index.js";
import errorHandler from "./shared/middleware/errorHandler.js";

const app = express();

app.use((req, res, next) => {
  res.setHeader('bypass-tunnel-reminder', 'true');
  next();
});

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
