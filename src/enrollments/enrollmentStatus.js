import { lastLoginFields } from "../db.js";

/**
 * @param {{ status?: string, enrolled_at?: Date | string, completed_at?: Date | string | null } | null | undefined} enrollmentRow
 */
export function resolveEnrollmentStatus(enrollmentRow) {
  if (!enrollmentRow) {
    return {
      enrollmentStatus: "available",
      enrolledAt: null,
      enrolledAtUk: null,
      completedAt: null,
      completedAtUk: null,
    };
  }

  const enrolled = lastLoginFields(enrollmentRow.enrolled_at);
  const completed = lastLoginFields(enrollmentRow.completed_at);

  if (enrollmentRow.status === "completed") {
    return {
      enrollmentStatus: "completed",
      enrolledAt: enrolled.lastLoginAt,
      enrolledAtUk: enrolled.lastLoginAtUk,
      completedAt: completed.lastLoginAt,
      completedAtUk: completed.lastLoginAtUk,
    };
  }

  return {
    enrollmentStatus: "enrolled",
    enrolledAt: enrolled.lastLoginAt,
    enrolledAtUk: enrolled.lastLoginAtUk,
    completedAt: null,
    completedAtUk: null,
  };
}

/**
 * @param {Record<string, unknown>} courseSummary
 * @param {{ status?: string, enrolled_at?: Date | string, completed_at?: Date | string | null } | null | undefined} enrollmentRow
 */
export function attachEnrollmentToCourse(courseSummary, enrollmentRow) {
  return {
    ...courseSummary,
    ...resolveEnrollmentStatus(enrollmentRow),
  };
}
