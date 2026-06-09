import { getQuestionCountFromLesson } from "../contentful/mapLesson.js";
import { lastLoginFields } from "../db.js";

/**
 * @param {{ status?: string, started_at?: Date | string, completed_at?: Date | string | null } | null | undefined} progressRow
 */
export function resolveLessonStatus(progressRow) {
  if (!progressRow) {
    return {
      lessonStatus: "not_started",
      startedAt: null,
      startedAtUk: null,
      completedAt: null,
      completedAtUk: null,
    };
  }

  const started = lastLoginFields(progressRow.started_at);
  const completed = lastLoginFields(progressRow.completed_at);

  if (progressRow.status === "completed") {
    return {
      lessonStatus: "completed",
      startedAt: started.lastLoginAt,
      startedAtUk: started.lastLoginAtUk,
      completedAt: completed.lastLoginAt,
      completedAtUk: completed.lastLoginAtUk,
    };
  }

  return {
    lessonStatus: "started",
    startedAt: started.lastLoginAt,
    startedAtUk: started.lastLoginAtUk,
    completedAt: null,
    completedAtUk: null,
  };
}

/**
 * @param {Record<string, unknown>} lessonSummary
 * @param {{ status?: string, started_at?: Date | string, completed_at?: Date | string | null } | null | undefined} progressRow
 */
export function attachLessonProgress(lessonSummary, progressRow) {
  return {
    ...lessonSummary,
    ...resolveLessonStatus(progressRow),
  };
}

/**
 * @param {Record<string, unknown>} lessonSummary
 * @param {{ status?: string, started_at?: Date | string, completed_at?: Date | string | null } | null | undefined} progressRow
 * @param {unknown} lessonLink
 * @param {number} answeredCount
 */
export function attachLessonProgressWithCounts(
  lessonSummary,
  progressRow,
  lessonLink,
  answeredCount,
) {
  const questionCount = getQuestionCountFromLesson(lessonLink);
  return {
    ...lessonSummary,
    ...resolveLessonStatus(progressRow),
    questionCount,
    answeredCount,
  };
}

/**
 * @param {Record<string, unknown>} courseDetail
 * @param {Record<string, object>} progressByLessonId
 * @param {Record<string, number>} answeredCountByLessonId
 * @param {import('contentful').Entry} courseEntry
 */
export function attachLessonProgressToCourse(
  courseDetail,
  progressByLessonId,
  answeredCountByLessonId,
  courseEntry,
) {
  const lessons = courseDetail.lessons;
  if (!Array.isArray(lessons)) {
    return courseDetail;
  }

  const rawLessons = courseEntry.fields?.courseLessons;
  const lessonLinks = Array.isArray(rawLessons) ? rawLessons : [];

  return {
    ...courseDetail,
    lessons: lessons.map((lesson, index) => {
      const lessonId =
        lesson && typeof lesson === "object" && "id" in lesson
          ? /** @type {{ id: string }} */ (lesson).id
          : null;
      const progress = lessonId ? progressByLessonId[lessonId] : undefined;
      const answeredCount = lessonId
        ? (answeredCountByLessonId[lessonId] ?? 0)
        : 0;
      const lessonLink = lessonLinks[index] ?? null;
      return attachLessonProgressWithCounts(
        /** @type {Record<string, unknown>} */ (lesson),
        progress,
        lessonLink,
        answeredCount,
      );
    }),
  };
}
