import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRoleClaimValue } from "../src/auth/profileFromToken.js";

test("normalizeRoleClaimValue parses string", () => {
  assert.equal(normalizeRoleClaimValue(" admin "), "admin");
});

test("normalizeRoleClaimValue joins string arrays", () => {
  assert.equal(normalizeRoleClaimValue(["instructor", "learner"]), "instructor, learner");
});

test("normalizeRoleClaimValue reads { name } from Auth0 role objects", () => {
  assert.equal(normalizeRoleClaimValue([{ name: "Administrator" }, { name: "Member" }]), "Administrator, Member");
});

test("normalizeRoleClaimValue returns null when empty", () => {
  assert.equal(normalizeRoleClaimValue(null), null);
  assert.equal(normalizeRoleClaimValue([]), null);
  assert.equal(normalizeRoleClaimValue("   "), null);
});
