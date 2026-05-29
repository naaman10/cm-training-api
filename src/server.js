import "./loadEnv.js";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { getPool } from "./db.js";
import {
  attachSwaggerDocs,
  swaggerHelmetOptions,
} from "./swagger/swagger.js";

const requiredEnv = [
  "AUTH0_DOMAIN",
  "AUTH0_AUDIENCE",
  "AUTH0_M2M_CLIENT_ID",
  "AUTH0_M2M_CLIENT_SECRET",
  "AUTH0_DB_CONNECTION",
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
const { default: healthRoutes } = await import("./routes/health.js");
const { default: coursesRoutes } = await import("./routes/courses.js");

const app = express();
const port = Number(process.env.PORT) || 3001;
const isProduction = process.env.NODE_ENV === "production";

attachSwaggerDocs(app);

app.use(helmet(swaggerHelmetOptions(isProduction)));
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

app.use("/health", healthRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminUsersRoutes);
app.use("/api/courses", coursesRoutes);

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
  if (!isProduction) {
    console.log(`Swagger UI (dev): http://localhost:${port}/api-docs`);
  }
});

process.on("SIGTERM", async () => {
  try {
    await getPool().end();
  } catch {
    // pool may not be initialized
  }
  process.exit(0);
});
