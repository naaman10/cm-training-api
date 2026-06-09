import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findLessonOnCourse,
  getOrderedQuestionIds,
  isValidAnswerForLessonQuestion,
  mapLessonDetail,
} from "../src/contentful/mapLesson.js";

test("findLessonOnCourse returns matching lesson link", () => {
  const course = {
    sys: { id: "course-1" },
    fields: {
      courseLessons: [
        { sys: { id: "lesson-1" }, fields: { lessonName: "Intro" } },
        { sys: { id: "lesson-2" }, fields: { lessonName: "Next" } },
      ],
    },
  };
  const lesson = findLessonOnCourse(course, "lesson-2");
  assert.equal(lesson?.sys?.id, "lesson-2");
  assert.equal(findLessonOnCourse(course, "missing"), null);
});

test("mapLessonDetail maps questions and answers with Cloudinary image", () => {
  const lesson = mapLessonDetail({
    sys: { id: "lesson-1" },
    fields: {
      lessonName: "Quiz lesson",
      completionCriteria: 80,
      questions: [
        {
          sys: { id: "q-1" },
          fields: {
            question: "What is 2+2?",
            questionSummary: "Math",
            correctAnswer: {
              sys: { id: "a-1" },
              fields: {
                answerText: "4",
                answerImage: {
                  sys: { id: "img-1" },
                  fields: {
                    image: {
                      secure_url: "https://res.cloudinary.com/example/4.png",
                      width: 100,
                      height: 50,
                    },
                  },
                },
              },
            },
            incorrectAnswers: [
              {
                sys: { id: "a-2" },
                fields: { answerText: "5" },
              },
            ],
          },
        },
      ],
    },
  });

  assert.equal(lesson.id, "lesson-1");
  assert.equal(lesson.lessonName, "Quiz lesson");
  assert.equal(lesson.completionCriteria, 80);
  assert.equal(lesson.questions.length, 1);
  assert.equal(lesson.questions[0].question, "What is 2+2?");
  assert.equal(lesson.questions[0].correctAnswer?.answerText, "4");
  assert.equal(
    lesson.questions[0].correctAnswer?.answerImage?.url,
    "https://res.cloudinary.com/example/4.png",
  );
  assert.equal(lesson.questions[0].incorrectAnswers[0].answerText, "5");
});

test("mapLessonDetail returns empty questions when none linked", () => {
  const lesson = mapLessonDetail({
    sys: { id: "lesson-1" },
    fields: { internalName: "Draft" },
  });
  assert.equal(lesson.lessonName, "Draft");
  assert.deepEqual(lesson.questions, []);
});

test("isValidAnswerForLessonQuestion accepts correct and incorrect answers", () => {
  const lesson = {
    sys: { id: "lesson-1" },
    fields: {
      questions: [
        {
          sys: { id: "q-1" },
          fields: {
            correctAnswer: { sys: { id: "a-correct" } },
            incorrectAnswers: [{ sys: { id: "a-wrong" } }],
          },
        },
      ],
    },
  };
  assert.equal(isValidAnswerForLessonQuestion(lesson, "q-1", "a-correct"), true);
  assert.equal(isValidAnswerForLessonQuestion(lesson, "q-1", "a-wrong"), true);
  assert.equal(isValidAnswerForLessonQuestion(lesson, "q-1", "a-other"), false);
  assert.equal(isValidAnswerForLessonQuestion(lesson, "q-missing", "a-correct"), false);
});

test("getOrderedQuestionIds preserves Contentful order", () => {
  const lesson = {
    fields: {
      questions: [{ sys: { id: "q2" } }, { sys: { id: "q1" } }],
    },
  };
  assert.deepEqual(getOrderedQuestionIds(lesson), ["q2", "q1"]);
});
