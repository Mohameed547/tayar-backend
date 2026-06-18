import express from "express";
import router from "./routes/index.js";
import errorHandler from './shared/middleware/errorHandler.js';
const app = express();

app.use(express.json());

// Health check

// Routes
app.use("/api", router);


// export default app;


app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});



// Middleware

app.use(express.urlencoded({ extended: true }));

// Routes


// Global Error Handler
app.use(errorHandler);

export default app;
