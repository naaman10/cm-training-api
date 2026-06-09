import { mapLessonDetail, getOrderedQuestionIds } from "../contentful/mapLesson.js";
import {
  findLessonProgressByUserCourseAndLesson,
  findLessonQuestionAnswersByLesson,
} from "../db.js";
import { buildLessonProgress } from "./buildLessonProgress.js";

/**
 * @param {string} userId
 * @param {string} courseId
 * @param {string} lessonId
 * @param {unknown} lessonEntry
 * @param {{ status?: string, started_at?: Date | string, completed_at?: Date | string | null } | null | undefined} [progressRow]
 */
export async function buildLessonResponse(
  userId,
  courseId,
  lessonId,
  lessonEntry,
  progressRow,
) {
  const lesson = mapLessonDetail(lessonEntry);
  const orderedQuestionIds = getOrderedQuestionIds(lessonEntry);

  const progress =
    progressRow ??
    (await findLessonProgressByUserCourseAndLesson(userId, courseId, lessonId));

  const answerRows = await findLessonQuestionAnswersByLesson(
    userId,
    courseId,
    lessonId,
  );

  return {
    lesson,
    progress: buildLessonProgress(progress, orderedQuestionIds, answerRows),
  };
}
