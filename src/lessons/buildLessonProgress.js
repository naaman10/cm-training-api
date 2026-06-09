import { toSafeLessonQuestionAnswer } from "../db.js";
import { resolveLessonStatus } from "./lessonStatus.js";

/**
 * @param {string[]} orderedQuestionIds
 * @param {Set<string>} answeredQuestionIdSet
 */
export function computeNextQuestionIndex(orderedQuestionIds, answeredQuestionIdSet) {
  for (let index = 0; index < orderedQuestionIds.length; index += 1) {
    if (!answeredQuestionIdSet.has(orderedQuestionIds[index])) {
      return index;
    }
  }
  return orderedQuestionIds.length;
}

/**
 * @param {{ status?: string, started_at?: Date | string, completed_at?: Date | string | null } | null | undefined} progressRow
 * @param {string[]} orderedQuestionIds
 * @param {Record<string, unknown>[]} answerRows
 */
export function buildLessonProgress(progressRow, orderedQuestionIds, answerRows) {
  const base = resolveLessonStatus(progressRow);
  const questionCount = orderedQuestionIds.length;
  const questionIdSet = new Set(orderedQuestionIds);

  const answers = answerRows
    .filter((row) => questionIdSet.has(row.contentful_question_id))
    .map((row) => toSafeLessonQuestionAnswer(row));

  const answeredQuestionIds = orderedQuestionIds.filter((id) =>
    answers.some((answer) => answer.questionId === id),
  );
  const answeredQuestionIdSet = new Set(answeredQuestionIds);
  const answeredCount = answeredQuestionIds.length;
  const nextQuestionIndex = computeNextQuestionIndex(
    orderedQuestionIds,
    answeredQuestionIdSet,
  );

  return {
    ...base,
    questionCount,
    answeredCount,
    nextQuestionIndex,
    answeredQuestionIds,
    answers,
  };
}
