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
  );
  assert.equal(course.lessons[0].lessonStatus, "started");
  assert.equal(course.lessons[1].lessonStatus, "not_started");
});

test("attachLessonProgress merges onto lesson summary", () => {
  const lesson = attachLessonProgress(
    { id: "lesson-1", order: 1 },
    { status: "started", started_at: new Date("2026-01-15T12:00:00.000Z") },
  );
  assert.equal(lesson.lessonStatus, "started");
  assert.equal(lesson.order, 1);
});
