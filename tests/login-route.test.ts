import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/prisma";
import { POST } from "../app/api/login/route";

type LoginRole = "STUDENT" | "GUARDIAN";

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
  await withUserLookup((async () => ({
    id,
    email: `${role.toLowerCase()}@example.test`,
    displayName: `Test ${role}`,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  })) as typeof prisma.user.findUnique, async () => {
    const formData = new FormData();
    formData.set("role", role);
    formData.set("email", `${role.toLowerCase()}@example.test`);
    const response = await POST(new Request("https://studyplan.example/api/login", { method: "POST", body: formData }));

    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), `https://studyplan.example${path}`);
    assert.match(response.headers.get("set-cookie") ?? "", new RegExp(`studyplan_session=${role}%3A${id}`));
  });
}

test("student login returns a redirect with a session cookie", async () => {
  await assertSuccessfulLogin("STUDENT", "/student");
});

test("guardian login returns a redirect with a session cookie", async () => {
  await assertSuccessfulLogin("GUARDIAN", "/guardian");
});

test("login redirects to a retryable error when the database lookup fails", async () => {
  await withUserLookup((async () => {
    throw new Error('prepared statement "s0" already exists');
  }) as typeof prisma.user.findUnique, async () => {
    const formData = new FormData();
    formData.set("role", "GUARDIAN");
    formData.set("email", "guardian@example.test");
    const response = await POST(new Request("https://studyplan.example/api/login", { method: "POST", body: formData }));

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("location"),
      "https://studyplan.example/login?error=database-unavailable&role=GUARDIAN",
    );
  });
});
