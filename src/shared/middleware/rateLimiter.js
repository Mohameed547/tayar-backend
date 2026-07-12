import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// ─── Auth limiter (login, register) ──────────────────────────────────────────
// Per-IP: 10 attempts per 15 min (prevents credential stuffing)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req),
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again in 15 minutes.",
  },
  skip: (req) => process.env.NODE_ENV !== "production",
});

// ─── Account lifecycle limiter ────────────────────────────────────────────────
// Per-user (not per-IP) when authenticated: 3 destructive operations per hour.
// This prevents a compromised token from looping deletion requests.
export const accountLifecycleLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  // Key by user ID (attached by authenticate middleware) falling back to IP
  keyGenerator: (req) => req.user?._id?.toString() ?? ipKeyGenerator(req),
  message: {
    success: false,
    message: "Too many account operations. Please wait before trying again.",
  },
  skip: (req) => process.env.NODE_ENV !== "production",
});

// ─── Admin action limiter ─────────────────────────────────────────────────────
// Prevents admin token abuse for mass status changes
export const adminActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req),
  message: {
    success: false,
    message: "Too many admin requests. Please slow down.",
  },
  skip: (req) => process.env.NODE_ENV !== "production",
});
