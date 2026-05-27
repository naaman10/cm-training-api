import pg from "pg";
import { createPoolConfig } from "./dbPoolConfig.js";

const { Pool } = pg;

let pool;

const ukLoginFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  dateStyle: "short",
  timeStyle: "medium",
});

export function getPool() {
  if (!pool) {
    pool = new Pool(createPoolConfig());
  }
  return pool;
}

/**
 * last_login_at is stored as timestamptz (UTC in Neon). UK wall time for display only.
 * @param {Date | string | null | undefined} value
 */
export function lastLoginFields(value) {
  if (value == null) {
    return { lastLoginAt: null, lastLoginAtUk: null };
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return { lastLoginAt: null, lastLoginAtUk: null };
  }
  return {
    lastLoginAt: d.toISOString(),
    lastLoginAtUk: ukLoginFormatter.format(d),
  };
}

/**
 * @param {string} auth0UserId Auth0 `sub` claim
 */
export async function findUserByAuth0Id(auth0UserId) {
  const result = await getPool().query(
    `SELECT id, auth0_user_id, email, first_name, last_name, role, status, created_at, updated_at, last_login_at
     FROM users
     WHERE auth0_user_id = $1`,
    [auth0UserId],
  );
  return result.rows[0] ?? null;
}

/**
 * Upsert on Auth0 login: create **active** user if new (portal access unless later suspended/blocked).
 * Role: `rolesFromAuth0` from JWT when AUTH0_ROLES_CLAIM + Action are set; else DEFAULT_NEW_USER_ROLE on insert only.
 *
 * @param {string} auth0UserId
 * @param {{ email: string | null, firstName: string | null, lastName: string | null, rolesFromAuth0: string | null }} profile
 * @returns {Promise<{ ok: true, user: object } | { ok: false, code: 'MISSING_EMAIL' | 'EMAIL_CONFLICT' }>}
 */
export async function upsertUserOnLogin(auth0UserId, profile) {
  const defaultRole =
    process.env.DEFAULT_NEW_USER_ROLE?.trim() || "learner";
  const tokenEmail = profile.email?.trim() || null;
  const firstName = profile.firstName ?? null;
  const lastName = profile.lastName ?? null;
  const tokenRoleNormalized = profile.rolesFromAuth0?.trim()
    ? profile.rolesFromAuth0.trim()
    : null;

  const existing = await findUserByAuth0Id(auth0UserId);
  const resolvedEmail = tokenEmail || existing?.email || null;

  if (!existing && !tokenEmail) {
    return { ok: false, code: "MISSING_EMAIL" };
  }
  if (!resolvedEmail) {
    return { ok: false, code: "MISSING_EMAIL" };
  }

  try {
    const result = await getPool().query(
      `INSERT INTO users (auth0_user_id, email, first_name, last_name, role, status, last_login_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, COALESCE(NULLIF(TRIM($5), ''), $6), 'active', NOW(), NOW(), NOW())
       ON CONFLICT (auth0_user_id) DO UPDATE SET
         last_login_at = NOW(),
         updated_at = NOW(),
         email = CASE
           WHEN NULLIF(EXCLUDED.email, '') IS NOT NULL THEN EXCLUDED.email
           ELSE users.email
         END,
         first_name = COALESCE(EXCLUDED.first_name, users.first_name),
         last_name = COALESCE(EXCLUDED.last_name, users.last_name),
         role = COALESCE(NULLIF(TRIM($5), ''), users.role)
       RETURNING id, auth0_user_id, email, first_name, last_name, role, status, created_at, updated_at, last_login_at`,
      [
        auth0UserId,
        resolvedEmail,
        firstName,
        lastName,
        tokenRoleNormalized ?? "",
        defaultRole,
      ],
    );
    return { ok: true, user: result.rows[0] };
  } catch (e) {
    if (e.code === "23505") {
      return { ok: false, code: "EMAIL_CONFLICT" };
    }
    throw e;
  }
}

export async function findAllUsers() {
  const result = await getPool().query(
    `SELECT id, email, first_name, last_name, role, status, created_at, updated_at, last_login_at
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
    ...lastLoginFields(row.last_login_at),
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
    ...lastLoginFields(row.last_login_at),
  };
}
