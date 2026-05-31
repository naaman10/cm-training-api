import assert from "node:assert/strict";
import test from "node:test";
import {
  attachEnrollmentToCourse,
  resolveEnrollmentStatus,
} from "../src/enrollments/enrollmentStatus.js";
import { toSafeEnrollment } from "../src/db.js";

test("resolveEnrollmentStatus returns available when no row", () => {
  const status = resolveEnrollmentStatus(null);
  assert.equal(status.enrollmentStatus, "available");
  assert.equal(status.enrolledAt, null);
  assert.equal(status.completedAt, null);
});

test("resolveEnrollmentStatus returns enrolled with enrolledAt only", () => {
  const status = resolveEnrollmentStatus({
    status: "enrolled",
    enrolled_at: new Date("2026-05-28T12:00:00.000Z"),
    completed_at: null,
  });
  assert.equal(status.enrollmentStatus, "enrolled");
  assert.equal(status.enrolledAt, "2026-05-28T12:00:00.000Z");
  assert.equal(status.completedAt, null);
});

test("resolveEnrollmentStatus returns completed with both dates", () => {
  const status = resolveEnrollmentStatus({
    status: "completed",
    enrolled_at: new Date("2026-05-28T12:00:00.000Z"),
    completed_at: new Date("2026-05-29T10:00:00.000Z"),
  });
  assert.equal(status.enrollmentStatus, "completed");
  assert.equal(status.completedAt, "2026-05-29T10:00:00.000Z");
});

test("attachEnrollmentToCourse merges onto course summary", () => {
  const course = attachEnrollmentToCourse(
    { id: "c1", courseName: "Test" },
    { status: "enrolled", enrolled_at: new Date("2026-05-28T12:00:00.000Z") },
  );
  assert.equal(course.id, "c1");
  assert.equal(course.enrollmentStatus, "enrolled");
});

test("toSafeEnrollment maps db row", () => {
  const safe = toSafeEnrollment({
    id: "e1",
    contentful_course_id: "c1",
    status: "completed",
    enrolled_at: new Date("2026-05-28T12:00:00.000Z"),
    completed_at: new Date("2026-05-29T10:00:00.000Z"),
  });
  assert.equal(safe.courseId, "c1");
  assert.equal(safe.status, "completed");
  assert.equal(safe.completedAt, "2026-05-29T10:00:00.000Z");
});
