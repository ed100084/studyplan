import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "@prisma/client";
import { hashPassword, isValidPassword, verifyPassword } from "../lib/password";
import { createSessionToken, parseSessionToken } from "../lib/session";

process.env.SESSION_SECRET = "test-session-secret-that-is-long-enough";

test("password hashes verify only the original password", async () => {
  const hash = await hashPassword("correct-horse-123");

  assert.equal(await verifyPassword("correct-horse-123", hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
  assert.notEqual(hash, "correct-horse-123");
});

test("password validation enforces the supported length", () => {
  assert.equal(isValidPassword("short"), false);
  assert.equal(isValidPassword("long-enough"), true);
  assert.equal(isValidPassword("x".repeat(129)), false);
});

test("signed sessions reject tampering and expiration", () => {
  const now = Date.UTC(2026, 5, 15);
  const token = createSessionToken({ role: UserRole.STUDENT, userId: "student-1" }, now);

  assert.deepEqual(parseSessionToken(token, now), { role: UserRole.STUDENT, userId: "student-1" });
  assert.equal(parseSessionToken(`${token}tampered`, now), null);
  assert.equal(parseSessionToken(`${token}.extra`, now), null);
  assert.equal(parseSessionToken(token, now + 31 * 24 * 60 * 60 * 1000), null);
  assert.equal(parseSessionToken("STUDENT:student-1", now), null);
});
