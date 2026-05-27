import assert from "node:assert/strict";
import test from "node:test";
import { isBlockedAccountStatus } from "../src/auth/accountStatus.js";

test("isBlockedAccountStatus is true for suspended/blocked only", () => {
  assert.equal(isBlockedAccountStatus("suspended"), true);
  assert.equal(isBlockedAccountStatus("blocked"), true);
  assert.equal(isBlockedAccountStatus("SUSPENDED"), true);
});

test("isBlockedAccountStatus is false for normal or legacy statuses", () => {
  assert.equal(isBlockedAccountStatus("active"), false);
  assert.equal(isBlockedAccountStatus("pending"), false);
  assert.equal(isBlockedAccountStatus("inactive"), false);
  assert.equal(isBlockedAccountStatus(""), false);
  assert.equal(isBlockedAccountStatus(null), false);
});
