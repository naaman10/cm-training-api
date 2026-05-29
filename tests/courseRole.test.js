import assert from "node:assert/strict";
import test from "node:test";
import {
  getUserRoles,
  sanitizeCourseRole,
  userCanAccessCourse,
} from "../src/contentful/courseRole.js";

test("sanitizeCourseRole lowercases valid Contentful values", () => {
  assert.equal(sanitizeCourseRole("Admin"), "admin");
  assert.equal(sanitizeCourseRole("Instructor"), "instructor");
  assert.equal(sanitizeCourseRole("Learner"), "learner");
});

test("sanitizeCourseRole returns null for invalid values", () => {
  assert.equal(sanitizeCourseRole(""), null);
  assert.equal(sanitizeCourseRole("guest"), null);
  assert.equal(sanitizeCourseRole(null), null);
});

test("userCanAccessCourse allows admin to see any course role", () => {
  assert.equal(userCanAccessCourse(["admin"], "Learner"), true);
  assert.equal(userCanAccessCourse(["admin"], "instructor"), true);
  assert.equal(userCanAccessCourse(["admin"], null), true);
});

test("userCanAccessCourse matches instructor and learner only", () => {
  assert.equal(userCanAccessCourse(["instructor"], "Instructor"), true);
  assert.equal(userCanAccessCourse(["learner"], "Learner"), true);
  assert.equal(userCanAccessCourse(["instructor"], "Learner"), false);
});

test("getUserRoles parses comma-separated Neon role", () => {
  assert.deepEqual(getUserRoles({ role: "admin, Instructor" }), [
    "admin",
    "instructor",
  ]);
});
