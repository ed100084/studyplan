import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "studyplan_session";
const loginRoles = [UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CLASS_ADMIN] as const;

function rolePath(role: (typeof loginRoles)[number]) {
  if (role === UserRole.STUDENT) return "/student";
  if (role === UserRole.GUARDIAN) return "/guardian";
  return "/class-admin";
}

function loginRedirect(request: Request, error: string, role?: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  if (role) url.searchParams.set("role", role);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const emailValue = formData.get("email");
  const roleValue = formData.get("role");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const role = typeof roleValue === "string"
    ? loginRoles.find((candidate) => candidate === roleValue)
    : undefined;

  if (!email || !role) return loginRedirect(request, "missing-fields");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== role) {
    return loginRedirect(request, "account-not-found", role);
  }

  const response = NextResponse.redirect(new URL(rolePath(role), request.url), 303);
  response.cookies.set(SESSION_COOKIE, `${user.role}:${user.id}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
