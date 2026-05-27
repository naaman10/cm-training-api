import "./loadEnv.js";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { getPool } from "./db.js";

const requiredEnv = [
  "AUTH0_DOMAIN",
  "AUTH0_AUDIENCE",
  "DATABASE_URL",
  "FRONTEND_ORIGIN",
];
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const { default: authRoutes } = await import("./routes/auth.js");
const { default: adminUsersRoutes } = await import("./routes/adminUsers.js");

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminUsersRoutes);

// express-oauth2-jwt-bearer sends 401 for invalid/missing tokens
app.use((err, _req, res, _next) => {
  if (
    err.name === "UnauthorizedError" ||
    err.name === "InvalidTokenError" ||
    err.status === 401 ||
    err.statusCode === 401
  ) {
    return res.status(401).json({
      error: "Unauthorized",
      message: err.message ?? "Invalid or missing access token",
    });
  }

  console.error(err);
  res.status(500).json({
    error: "Internal Server Error",
    message: "An unexpected error occurred",
  });
});

app.listen(port, () => {
  console.log(`CM Training API listening on port ${port}`);
});

process.on("SIGTERM", async () => {
  try {
    await getPool().end();
  } catch {
    // pool may not be initialized
  }
  process.exit(0);
});
