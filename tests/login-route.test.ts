import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/prisma";
import { POST } from "../app/api/login/route";

test("student login returns a redirect with a session cookie", async () => {
  const originalFindUnique = prisma.user.findUnique.bind(prisma.user);
  (prisma.user as unknown as { findUnique: typeof prisma.user.findUnique }).findUnique = (async () => ({
    id: "student-test-id",
    email: "student@example.test",
    displayName: "Test Student",
    role: "STUDENT",
    createdAt: new Date(),
    updatedAt: new Date(),
  })) as typeof prisma.user.findUnique;

  try {
    const formData = new FormData();
    formData.set("role", "STUDENT");
    formData.set("email", "student@example.test");
    const response = await POST(new Request("https://studyplan.example/api/login", { method: "POST", body: formData }));

    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "https://studyplan.example/student");
    assert.match(response.headers.get("set-cookie") ?? "", /studyplan_session=STUDENT%3Astudent-test-id/);
  } finally {
    (prisma.user as unknown as { findUnique: typeof prisma.user.findUnique }).findUnique = originalFindUnique;
  }
});
