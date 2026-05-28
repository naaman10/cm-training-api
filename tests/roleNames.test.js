import assert from "node:assert/strict";
import test from "node:test";
import { parseRoleNamesFromDbRole } from "../src/auth/roleNames.js";

test("parseRoleNamesFromDbRole splits comma-separated roles", () => {
  assert.deepEqual(parseRoleNamesFromDbRole("admin, instructor"), [
    "admin",
    "instructor",
  ]);
});

test("parseRoleNamesFromDbRole returns single role", () => {
  assert.deepEqual(parseRoleNamesFromDbRole("learner"), ["learner"]);
});

test("parseRoleNamesFromDbRole returns empty for invalid input", () => {
  assert.deepEqual(parseRoleNamesFromDbRole(""), []);
  assert.deepEqual(parseRoleNamesFromDbRole(null), []);
});
