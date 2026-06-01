import {
  getUserRoles,
  userCanAccessCourse,
} from "../contentful/courseRole.js";
import { fetchCourseById } from "../contentful/fetchCourses.js";
import { findLessonOnCourse } from "../contentful/mapLesson.js";
import { findEnrollmentByUserAndCourse } from "../db.js";

/**
 * @param {import('contentful').Entry} courseEntry
 * @param {{ role?: unknown }} appUser
 */
function isCourseAccessible(courseEntry, appUser) {
  const userRoles = getUserRoles(appUser);
  return userCanAccessCourse(userRoles, courseEntry.fields?.courseRole);
}

/**
 * @param {string} courseId
 * @param {string} lessonId
 * @param {{ id: string, role?: unknown }} appUser
 * @param {{ include?: number }} [fetchOptions]
 */
export async function loadLessonForEnrolledUser(
  courseId,
  lessonId,
  appUser,
  fetchOptions = { include: 4 },
) {
  const entry = await fetchCourseById(courseId, fetchOptions);
  if (!isCourseAccessible(entry, appUser)) {
    return { error: "course_not_found" };
  }

  const enrollment = await findEnrollmentByUserAndCourse(appUser.id, courseId);
  if (!enrollment) {
    return { error: "not_enrolled" };
  }

  const lesson = findLessonOnCourse(entry, lessonId);
  if (!lesson) {
    return { error: "lesson_not_found" };
  }

  return { course: entry, lesson, enrollment };
}
