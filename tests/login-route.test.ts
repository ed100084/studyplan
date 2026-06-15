import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";
import { parseSessionToken } from "../lib/session";
import { POST } from "../app/api/login/route";

type LoginRole = "STUDENT" | "GUARDIAN" | "SYSTEM_ADMIN";
const TEST_PASSWORD = "correct-horse-123";

process.env.SESSION_SECRET = "test-session-secret-that-is-long-enough";

async function withUserLookup(
  lookup: typeof prisma.user.findUnique,
  callback: () => Promise<void>,
) {
  const originalFindUnique = prisma.user.findUnique.bind(prisma.user);
  (prisma.user as unknown as { findUnique: typeof prisma.user.findUnique }).findUnique = lookup;

  try {
    await callback();
  } finally {
    (prisma.user as unknown as { findUnique: typeof prisma.user.findUnique }).findUnique = originalFindUnique;
  }
}

async function assertSuccessfulLogin(role: LoginRole, path: string) {
  const id = `${role.toLowerCase()}-test-id`;
  const passwordHash = await hashPassword(TEST_PASSWORD);
  await withUserLookup((async () => ({
    id,
    email: `${role.toLowerCase()}@example.test`,
    passwordHash,
    authVersion: 2,
    displayName: `Test ${role}`,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  })) as typeof prisma.user.findUnique, async () => {
    const formData = new FormData();
    formData.set("role", role);
    formData.set("email", `${role.toLowerCase()}@example.test`);
    formData.set("password", TEST_PASSWORD);
    const response = await POST(new Request("https://studyplan.example/api/login", { method: "POST", body: formData }));

    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), `https://studyplan.example${path}`);
    const sessionCookie = response.headers.get("set-cookie")?.match(/studyplan_session=([^;]+)/)?.[1];
    assert.ok(sessionCookie);
    assert.deepEqual(parseSessionToken(decodeURIComponent(sessionCookie)), { role, userId: id, authVersion: 2 });
  });
}

test("student login returns a redirect with a session cookie", async () => {
  await assertSuccessfulLogin("STUDENT", "/student");
});

test("guardian login returns a redirect with a session cookie", async () => {
  await assertSuccessfulLogin("GUARDIAN", "/guardian");
});

test("system admin login returns the password reset workspace", async () => {
  await assertSuccessfulLogin("SYSTEM_ADMIN", "/system-admin/users");
});

test("login redirects to a retryable error when the database lookup fails", async () => {
  await withUserLookup((async () => {
    throw new Error('prepared statement "s0" already exists');
  }) as typeof prisma.user.findUnique, async () => {
    const formData = new FormData();
    formData.set("role", "GUARDIAN");
    formData.set("email", "guardian@example.test");
    formData.set("password", TEST_PASSWORD);
    const response = await POST(new Request("https://studyplan.example/api/login", { method: "POST", body: formData }));

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("location"),
      "https://studyplan.example/login?error=database-unavailable&role=GUARDIAN",
    );
  });
});

test("login rejects an incorrect password", async () => {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  await withUserLookup((async () => ({
    id: "student-test-id",
    email: "student@example.test",
    passwordHash,
    authVersion: 0,
    displayName: "Test Student",
    role: "STUDENT",
    createdAt: new Date(),
    updatedAt: new Date(),
  })) as typeof prisma.user.findUnique, async () => {
    const formData = new FormData();
    formData.set("role", "STUDENT");
    formData.set("email", "student@example.test");
    formData.set("password", "incorrect-password");
    const response = await POST(new Request("https://studyplan.example/api/login", { method: "POST", body: formData }));

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("location"),
      "https://studyplan.example/login?error=invalid-credentials&role=STUDENT",
    );
    assert.equal(response.headers.get("set-cookie"), null);
  });
});

test("login rejects a legacy account without a password", async () => {
  await withUserLookup((async () => ({
    id: "guardian-test-id",
    email: "guardian@example.test",
    passwordHash: null,
    authVersion: 0,
    displayName: "Test Guardian",
    role: "GUARDIAN",
    createdAt: new Date(),
    updatedAt: new Date(),
  })) as typeof prisma.user.findUnique, async () => {
    const formData = new FormData();
    formData.set("role", "GUARDIAN");
    formData.set("email", "guardian@example.test");
    formData.set("password", TEST_PASSWORD);
    const response = await POST(new Request("https://studyplan.example/api/login", { method: "POST", body: formData }));

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("location"),
      "https://studyplan.example/login?error=password-not-set&role=GUARDIAN",
    );
  });
});
