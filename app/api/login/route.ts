import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidPassword, verifyPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

const loginRoles = [UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CLASS_ADMIN, UserRole.SYSTEM_ADMIN] as const;
const DUMMY_PASSWORD_HASH = "scrypt$16384$8$1$c3R1ZHlwbGFuLWxvZ2luLWR1bW15LXNhbHQ$Xgl8KhjbtJZS3vfRheDb2l-9GsEkDmj7ATxeAao602piZuwmouugNcg2Rm0TNFAhhrOY6vvt2MdGAX9eUf8HVQ";

function rolePath(role: (typeof loginRoles)[number]) {
  if (role === UserRole.STUDENT) return "/student";
  if (role === UserRole.GUARDIAN) return "/guardian";
  if (role === UserRole.CLASS_ADMIN) return "/class-admin";
  return "/system-admin/users";
}

function loginRedirect(request: Request, error: string, role?: string) {
  const url = new URL(role === UserRole.SYSTEM_ADMIN ? "/system-admin/login" : "/login", request.url);
  url.searchParams.set("error", error);
  if (role) url.searchParams.set("role", role);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const roleValue = formData.get("role");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const role = typeof roleValue === "string"
    ? loginRoles.find((candidate) => candidate === roleValue)
    : undefined;

  if (!email || !password || !role) return loginRedirect(request, "missing-fields", role);
  if (!isValidPassword(password)) {
    await verifyPassword("invalid-password", DUMMY_PASSWORD_HASH);
    return loginRedirect(request, "invalid-credentials", role);
  }

  let user;
  try {
    user = await prisma.user.findUnique({ where: { email } });
  } catch (error) {
    console.error("[api/login] user lookup failed", {
      role,
      error: error instanceof Error ? error.message : String(error),
    });
    return loginRedirect(request, "database-unavailable", role);
  }

  if (!user || user.role !== role) {
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    return loginRedirect(request, "invalid-credentials", role);
  }

  if (!user.passwordHash) {
    return loginRedirect(request, "password-not-set", role);
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return loginRedirect(request, "invalid-credentials", role);
  }

  const response = NextResponse.redirect(new URL(rolePath(role), request.url), 303);
  response.cookies.set(SESSION_COOKIE, createSessionToken({ role: user.role, userId: user.id, authVersion: user.authVersion }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
