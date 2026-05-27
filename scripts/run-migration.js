import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { createPoolConfig } from "../src/dbPoolConfig.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "../migrations");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const pool = new pg.Pool(createPoolConfig());

try {
  for (const file of files) {
    const migrationPath = join(migrationsDir, file);
    const sql = readFileSync(migrationPath, "utf8");
    await pool.query(sql);
    console.log("Migration applied:", migrationPath);
  }
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
} finally {
  await pool.end();
}
