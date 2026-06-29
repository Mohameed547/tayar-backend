import express from "express";
import cors from "cors";
import router from "./routes/index.js";
import errorHandler from "./shared/middleware/errorHandler.js";

const app = express();

app.use((req, res, next) => {
  res.setHeader('bypass-tunnel-reminder', 'true');
  next();
});
// CORS
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  process.env.CLIENT_ORIGIN
].filter(Boolean);

app.use(
    cors({
        origin: function(origin, callback) {
            if (!origin) return callback(null, true);
            if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes("*")) {
                return callback(null, true);
            }
            return callback(new Error('CORS mismatch'), false);
        },
        credentials: true,
    }),
);

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Health check
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", message: "Server is running" });
});

// Routes
app.use("/api", router);

// Global Error Handler
app.use(errorHandler);

export default app;
