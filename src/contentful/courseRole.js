import { parseRoleNamesFromDbRole } from "../auth/roleNames.js";

const VALID_COURSE_ROLES = new Set(["admin", "instructor", "learner"]);

/**
 * Normalize Contentful courseRole (e.g. "Instructor") to API role (e.g. "instructor").
 * @param {unknown} value
 * @returns {"admin" | "instructor" | "learner" | null}
 */
export function sanitizeCourseRole(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return VALID_COURSE_ROLES.has(normalized) ? normalized : null;
}

/**
 * @param {{ role?: unknown }} appUser Neon user row from loadAppUser
 * @returns {string[]}
 */
export function getUserRoles(appUser) {
  return parseRoleNamesFromDbRole(appUser?.role).map((role) => role.toLowerCase());
}

/**
 * @param {string[]} userRoles
 * @param {unknown} courseRole Raw or sanitized Contentful courseRole
 */
export function userCanAccessCourse(userRoles, courseRole) {
  if (userRoles.includes("admin")) {
    return true;
  }
  const sanitized = sanitizeCourseRole(courseRole);
  if (!sanitized) {
    return false;
  }
  return userRoles.includes(sanitized);
}
