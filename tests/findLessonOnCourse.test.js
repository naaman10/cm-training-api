import assert from "node:assert/strict";
import { test } from "node:test";
import { findLessonOnCourse } from "../src/contentful/mapLesson.js";

test("findLessonOnCourse returns null when course has no lessons", () => {
  assert.equal(
    findLessonOnCourse({ sys: { id: "c" }, fields: {} }, "lesson-1"),
    null,
  );
});

test("findLessonOnCourse matches unresolved link by id only", () => {
  const link = { sys: { id: "lesson-abc", type: "Link", linkType: "Entry" } };
  const course = {
    sys: { id: "course-1" },
    fields: { courseLessons: [link] },
  };
  assert.equal(findLessonOnCourse(course, "lesson-abc"), link);
});
