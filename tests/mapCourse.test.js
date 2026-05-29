import assert from "node:assert/strict";
import test from "node:test";
import { getLessonCount, mapCourseSummary } from "../src/contentful/mapCourse.js";

test("getLessonCount returns 0 when courseLessons missing", () => {
  assert.equal(getLessonCount({ sys: { id: "x" }, fields: {} }), 0);
});

test("getLessonCount returns link array length without resolving lessons", () => {
  const entry = {
    sys: { id: "course-1" },
    fields: {
      courseName: "Test",
      courseRole: "Learner",
      courseLessons: [{ sys: { id: "l1" } }, { sys: { id: "l2" } }, { sys: { id: "l3" } }],
    },
  };
  assert.equal(getLessonCount(entry), 3);
});

test("mapCourseSummary includes lessonCount and sanitized courseRole", () => {
  const summary = mapCourseSummary({
    sys: { id: "course-1" },
    fields: {
      internalName: "internal",
      courseName: "Course A",
      courseRole: "Instructor",
      courseLessons: [{ sys: { id: "l1" } }],
      coursePrerequisite: [{ sys: { id: "pre-1" } }],
    },
  });
  assert.equal(summary.lessonCount, 1);
  assert.equal(summary.courseRole, "instructor");
  assert.deepEqual(summary.prerequisiteIds, ["pre-1"]);
  assert.equal(summary.courseName, "Course A");
});
