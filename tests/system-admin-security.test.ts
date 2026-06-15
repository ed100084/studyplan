import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "@prisma/client";
import { secretsEqual } from "../lib/secrets";
import {
  canReplaceExistingAccount,
  isResettableUserRole,
  replaceAccountConfirmation,
} from "../lib/system-admin";

test("bootstrap secrets use exact constant-time comparison semantics", () => {
  assert.equal(secretsEqual("correct-secret", "correct-secret"), true);
  assert.equal(secretsEqual("correct-secret", "wrong-secret"), false);
  assert.equal(secretsEqual("", "correct-secret"), false);
  assert.equal(secretsEqual("correct-secret", undefined), false);
});

test("system admins can reset only supported user-facing roles", () => {
  assert.equal(isResettableUserRole(UserRole.STUDENT), true);
  assert.equal(isResettableUserRole(UserRole.GUARDIAN), true);
  assert.equal(isResettableUserRole(UserRole.CLASS_ADMIN), true);
  assert.equal(isResettableUserRole(UserRole.SYSTEM_ADMIN), false);
  assert.equal(isResettableUserRole(UserRole.TEACHER), false);
});

test("replacing an existing bootstrap account requires explicit confirmation", () => {
  assert.equal(canReplaceExistingAccount(false, replaceAccountConfirmation), false);
  assert.equal(canReplaceExistingAccount(true, ""), false);
  assert.equal(canReplaceExistingAccount(true, "刪除帳號"), false);
  assert.equal(canReplaceExistingAccount(true, replaceAccountConfirmation), true);
});
