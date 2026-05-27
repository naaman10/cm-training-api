import pg from "pg";
import { createPoolConfig } from "./dbPoolConfig.js";

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool(createPoolConfig());
  }
  return pool;
}

/**
 * @param {string} auth0UserId Auth0 `sub` claim
 */
export async function findUserByAuth0Id(auth0UserId) {
  const result = await getPool().query(
    `SELECT id, auth0_user_id, email, first_name, last_name, role, status, created_at, updated_at
     FROM users
     WHERE auth0_user_id = $1`,
    [auth0UserId],
  );
  return result.rows[0] ?? null;
}

export async function findAllUsers() {
  const result = await getPool().query(
    `SELECT id, email, first_name, last_name, role, status, created_at, updated_at
     FROM users
     ORDER BY created_at DESC`,
  );
  return result.rows;
}

/**
 * Maps a DB row to a safe API response (no auth0_user_id or internal linkage).
 * @param {Record<string, unknown>} row
 */
export function toSafeUserProfile(row) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Admin list view — includes status for user management.
 * @param {Record<string, unknown>} row
 */
export function toSafeAdminUser(row) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
