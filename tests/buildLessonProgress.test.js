import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildLessonProgress,
  computeNextQuestionIndex,
} from "../src/lessons/buildLessonProgress.js";

test("computeNextQuestionIndex returns first unanswered index", () => {
  assert.equal(
    computeNextQuestionIndex(["q1", "q2", "q3"], new Set(["q1"])),
    1,
  );
  assert.equal(
    computeNextQuestionIndex(["q1", "q2"], new Set(["q1", "q2"])),
    2,
  );
  assert.equal(computeNextQuestionIndex([], new Set()), 0);
});

test("buildLessonProgress includes question progress fields", () => {
  const progress = buildLessonProgress(
    {
      status: "started",
      started_at: new Date("2026-01-15T12:00:00.000Z"),
      completed_at: null,
    },
    ["q1", "q2", "q3"],
    [
      {
        contentful_question_id: "q1",
        contentful_answer_id: "a1",
        answered_at: new Date("2026-01-15T12:05:00.000Z"),
      },
    ],
  );

  assert.equal(progress.lessonStatus, "started");
  assert.equal(progress.questionCount, 3);
  assert.equal(progress.answeredCount, 1);
  assert.equal(progress.nextQuestionIndex, 1);
  assert.deepEqual(progress.answeredQuestionIds, ["q1"]);
  assert.equal(progress.answers.length, 1);
  assert.equal(progress.answers[0].questionId, "q1");
  assert.equal(progress.answers[0].answerId, "a1");
});

test("buildLessonProgress ignores answers for removed questions", () => {
  const progress = buildLessonProgress(null, ["q1"], [
    {
      contentful_question_id: "old-q",
      contentful_answer_id: "a9",
      answered_at: new Date("2026-01-15T12:05:00.000Z"),
    },
  ]);
  assert.equal(progress.answeredCount, 0);
  assert.equal(progress.nextQuestionIndex, 0);
});

test("buildLessonProgress not_started with no answers", () => {
  const progress = buildLessonProgress(null, ["q1", "q2"], []);
  assert.equal(progress.lessonStatus, "not_started");
  assert.equal(progress.questionCount, 2);
  assert.equal(progress.answeredCount, 0);
  assert.equal(progress.nextQuestionIndex, 0);
  assert.deepEqual(progress.answers, []);
});
