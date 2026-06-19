import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "@prisma/client";
import { secretsEqual } from "../lib/secrets";
import {
  canReplaceExistingAccount,
  isValidAccountEmail,
  isResettableUserRole,
  normalizeAccountEmail,
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

test("account email normalization and validation reject invalid login identifiers", () => {
  assert.equal(normalizeAccountEmail(" Student@Example.COM "), "student@example.com");
  assert.equal(isValidAccountEmail("student@example.com"), true);
  assert.equal(isValidAccountEmail("student"), false);
  assert.equal(isValidAccountEmail("student@example"), false);
  assert.equal(isValidAccountEmail("student @example.com"), false);
  assert.equal(isValidAccountEmail(`${"a".repeat(245)}@example.com`), false);
});
