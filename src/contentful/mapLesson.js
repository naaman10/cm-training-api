import { mapImageFromField } from "./mapImage.js";

/**
 * @param {unknown} linkOrEntry
 */
function linkEntryId(linkOrEntry) {
  if (!linkOrEntry || typeof linkOrEntry !== "object") {
    return null;
  }
  const entry = /** @type {{ sys?: { id?: string } }} */ (linkOrEntry);
  return entry.sys?.id ?? null;
}

/**
 * @param {unknown} answerLink
 */
function mapAnswer(answerLink) {
  const id = linkEntryId(answerLink);
  if (!id) {
    return null;
  }

  const resolved =
    answerLink && typeof answerLink === "object" && "fields" in answerLink
      ? /** @type {{ fields?: Record<string, unknown> }} */ (answerLink)
      : null;
  const fields = resolved?.fields ?? {};

  const answerText =
    typeof fields.answerText === "string" ? fields.answerText : null;

  return {
    id,
    answerText,
    answerImage: mapImageFromField(fields.answerImage),
  };
}

/**
 * @param {unknown} questionLink
 */
function mapQuestion(questionLink) {
  const id = linkEntryId(questionLink);
  if (!id) {
    return null;
  }

  const resolved =
    questionLink && typeof questionLink === "object" && "fields" in questionLink
      ? /** @type {{ fields?: Record<string, unknown> }} */ (questionLink)
      : null;
  const fields = resolved?.fields ?? {};

  const question =
    typeof fields.question === "string" ? fields.question : null;
  const questionSummary =
    typeof fields.questionSummary === "string" ? fields.questionSummary : null;

  const incorrectRaw = fields.incorrectAnswers;
  /** @type {ReturnType<typeof mapAnswer>[]} */
  const incorrectAnswers = [];
  if (Array.isArray(incorrectRaw)) {
    for (const item of incorrectRaw) {
      const mapped = mapAnswer(item);
      if (mapped) {
        incorrectAnswers.push(mapped);
      }
    }
  }

  return {
    id,
    question,
    questionSummary,
    correctAnswer: mapAnswer(fields.correctAnswer),
    incorrectAnswers,
  };
}

/**
 * @param {import('contentful').Entry | { sys: { id: string }, fields?: Record<string, unknown> }} lessonEntry
 */
export function mapLessonDetail(lessonEntry) {
  const fields = lessonEntry.fields ?? {};

  const lessonName =
    (typeof fields.lessonName === "string" && fields.lessonName.trim()) ||
    (typeof fields.internalName === "string" && fields.internalName.trim()) ||
    null;

  const questionsRaw = fields.questions;
  /** @type {ReturnType<typeof mapQuestion>[]} */
  const questions = [];
  if (Array.isArray(questionsRaw)) {
    for (const item of questionsRaw) {
      const mapped = mapQuestion(item);
      if (mapped) {
        questions.push(mapped);
      }
    }
  }

  return {
    id: lessonEntry.sys.id,
    lessonName,
    lessonDescription: fields.lessonDescription ?? null,
    completionCriteria:
      typeof fields.completionCriteria === "number"
        ? fields.completionCriteria
        : null,
    questions,
  };
}

/**
 * @param {import('contentful').Entry} courseEntry
 * @param {string} lessonId
 */
export function findLessonOnCourse(courseEntry, lessonId) {
  const lessons = courseEntry.fields?.courseLessons;
  if (!Array.isArray(lessons)) {
    return null;
  }

  for (const item of lessons) {
    if (linkEntryId(item) === lessonId) {
      return item;
    }
  }
  return null;
}
