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
    `SELECT id, auth0_user_id, email, first_name, last_name, role, status, created_at, updated_at, last_login_at
     FROM users
     ORDER BY created_at DESC`,
  );
  return result.rows;
}

/**
 * @param {string} id
 */
export async function findUserById(id) {
  const result = await getPool().query(
    `SELECT id, auth0_user_id, email, first_name, last_name, role, status, created_at, updated_at, last_login_at
     FROM users
     WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

/**
 * @param {{
 *   auth0UserId: string;
 *   email: string;
 *   firstName?: string | null;
 *   lastName?: string | null;
 *   role: string;
 *   status?: string;
 * }} input
 */
export async function createUser(input) {
  const result = await getPool().query(
    `INSERT INTO users (auth0_user_id, email, first_name, last_name, role, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, COALESCE(NULLIF(TRIM($6), ''), 'active'), NOW(), NOW())
     RETURNING id, auth0_user_id, email, first_name, last_name, role, status, created_at, updated_at, last_login_at`,
    [
      input.auth0UserId,
      input.email.trim(),
      input.firstName ?? null,
      input.lastName ?? null,
      input.role.trim(),
      input.status ?? "active",
    ],
  );
  return result.rows[0];
}

/**
 * @param {string} id
 * @param {{
 *   email?: string;
 *   firstName?: string | null;
 *   lastName?: string | null;
 *   role?: string;
 *   status?: string;
 * }} input
 */
export async function updateUserById(id, input) {
  const result = await getPool().query(
    `UPDATE users
     SET
       email = COALESCE($2, email),
       first_name = COALESCE($3, first_name),
       last_name = COALESCE($4, last_name),
       role = COALESCE($5, role),
       status = COALESCE($6, status),
       updated_at = NOW()
     WHERE id = $1
     RETURNING id, auth0_user_id, email, first_name, last_name, role, status, created_at, updated_at, last_login_at`,
    [
      id,
      input.email?.trim() || null,
      input.firstName ?? null,
      input.lastName ?? null,
      input.role?.trim() || null,
      input.status?.trim() || null,
    ],
  );
  return result.rows[0] ?? null;
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

const ENROLLMENT_COLUMNS = `id, user_id, contentful_course_id, status, enrolled_at, completed_at, updated_at`;

/**
 * @param {string} userId
 * @param {string} contentfulCourseId
 */
export async function createCourseEnrollment(userId, contentfulCourseId) {
  const result = await getPool().query(
    `INSERT INTO course_enrollments (user_id, contentful_course_id, status, enrolled_at, updated_at)
     VALUES ($1, $2, 'enrolled', NOW(), NOW())
     RETURNING ${ENROLLMENT_COLUMNS}`,
    [userId, contentfulCourseId],
  );
  return result.rows[0];
}

/**
 * @param {string} userId
 * @param {string} contentfulCourseId
 */
export async function completeCourseEnrollment(userId, contentfulCourseId) {
  const result = await getPool().query(
    `UPDATE course_enrollments
     SET
       status = 'completed',
       completed_at = COALESCE(completed_at, NOW()),
       updated_at = NOW()
     WHERE user_id = $1 AND contentful_course_id = $2
     RETURNING ${ENROLLMENT_COLUMNS}`,
    [userId, contentfulCourseId],
  );
  return result.rows[0] ?? null;
}

/**
 * @param {string} userId
 * @param {string} contentfulCourseId
 */
export async function findEnrollmentByUserAndCourse(userId, contentfulCourseId) {
  const result = await getPool().query(
    `SELECT ${ENROLLMENT_COLUMNS}
     FROM course_enrollments
     WHERE user_id = $1 AND contentful_course_id = $2`,
    [userId, contentfulCourseId],
  );
  return result.rows[0] ?? null;
}

/**
 * @param {string} userId
 * @returns {Promise<Record<string, object>>}
 */
export async function findEnrollmentsByUserId(userId) {
  const result = await getPool().query(
    `SELECT ${ENROLLMENT_COLUMNS}
     FROM course_enrollments
     WHERE user_id = $1`,
    [userId],
  );
  /** @type {Record<string, object>} */
  const map = {};
  for (const row of result.rows) {
    map[row.contentful_course_id] = row;
  }
  return map;
}

/**
 * @param {Record<string, unknown>} row
 */
export function toSafeEnrollment(row) {
  const enrolled = lastLoginFields(row.enrolled_at);
  const completed = lastLoginFields(row.completed_at);
  return {
    id: row.id,
    courseId: row.contentful_course_id,
    status: row.status,
    enrolledAt: enrolled.lastLoginAt,
    enrolledAtUk: enrolled.lastLoginAtUk,
    completedAt: completed.lastLoginAt,
    completedAtUk: completed.lastLoginAtUk,
  };
}
