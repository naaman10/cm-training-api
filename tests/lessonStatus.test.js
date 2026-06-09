import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attachLessonProgress,
  attachLessonProgressToCourse,
  resolveLessonStatus,
} from "../src/lessons/lessonStatus.js";

test("resolveLessonStatus returns not_started when no row", () => {
  const status = resolveLessonStatus(null);
  assert.equal(status.lessonStatus, "not_started");
  assert.equal(status.startedAt, null);
});

test("resolveLessonStatus returns started with timestamps", () => {
  const startedAt = new Date("2026-01-15T12:00:00.000Z");
  const status = resolveLessonStatus({
    status: "started",
    started_at: startedAt,
    completed_at: null,
  });
  assert.equal(status.lessonStatus, "started");
  assert.equal(status.startedAt, startedAt.toISOString());
  assert.ok(status.startedAtUk);
  assert.equal(status.completedAt, null);
});

test("resolveLessonStatus returns completed", () => {
  const startedAt = new Date("2026-01-15T12:00:00.000Z");
  const completedAt = new Date("2026-01-16T12:00:00.000Z");
  const status = resolveLessonStatus({
    status: "completed",
    started_at: startedAt,
    completed_at: completedAt,
  });
  assert.equal(status.lessonStatus, "completed");
  assert.equal(status.completedAt, completedAt.toISOString());
});

test("attachLessonProgressToCourse merges progress into lessons", () => {
  const course = attachLessonProgressToCourse(
    {
      id: "course-1",
      lessons: [
        { id: "lesson-1", order: 1, lessonName: "A" },
        { id: "lesson-2", order: 2, lessonName: "B" },
      ],
    },
    {
      "lesson-1": {
        status: "started",
        started_at: new Date("2026-01-15T12:00:00.000Z"),
        completed_at: null,
      },
    },
    { "lesson-1": 2 },
    {
      sys: { id: "course-1" },
      fields: {
        courseLessons: [
          {
            sys: { id: "lesson-1" },
            fields: { questions: [{ sys: { id: "q1" } }, { sys: { id: "q2" } }] },
          },
          { sys: { id: "lesson-2" }, fields: { questions: [{ sys: { id: "q3" } }] } },
        ],
      },
    },
  );
  assert.equal(course.lessons[0].lessonStatus, "started");
  assert.equal(course.lessons[0].questionCount, 2);
  assert.equal(course.lessons[0].answeredCount, 2);
  assert.equal(course.lessons[1].lessonStatus, "not_started");
  assert.equal(course.lessons[1].questionCount, 1);
  assert.equal(course.lessons[1].answeredCount, 0);
});

test("attachLessonProgress merges onto lesson summary", () => {
  const lesson = attachLessonProgress(
    { id: "lesson-1", order: 1 },
    { status: "started", started_at: new Date("2026-01-15T12:00:00.000Z") },
  );
  assert.equal(lesson.lessonStatus, "started");
  assert.equal(lesson.order, 1);
});
