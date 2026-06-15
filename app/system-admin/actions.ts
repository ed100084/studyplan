"use server";

import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { hashPassword, isValidPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { secretsEqual } from "@/lib/secrets";
import { setCurrentSession } from "@/lib/session";
import { getCurrentSystemAdmin, isResettableUserRole } from "@/lib/system-admin";

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function passwordValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function bootstrapSystemAdmin(formData: FormData) {
  const bootstrapSecret = passwordValue(formData, "bootstrapSecret");
  const configuredSecret = process.env.SYSTEM_ADMIN_BOOTSTRAP_SECRET;
  if (!configuredSecret || configuredSecret.length < 32 || !secretsEqual(bootstrapSecret, configuredSecret)) {
    redirect("/system-admin/setup?error=bootstrap-secret");
  }

  const existingAdmin = await prisma.user.findFirst({ where: { role: UserRole.SYSTEM_ADMIN } });
  if (existingAdmin) redirect("/system-admin/login");

  const displayName = formText(formData, "displayName") || "系統管理者";
  const email = formText(formData, "email").toLowerCase();
  const password = passwordValue(formData, "password");
  const confirmPassword = passwordValue(formData, "confirmPassword");

  if (!email) redirect("/system-admin/setup?error=email-required");
  if (!isValidPassword(password)) redirect("/system-admin/setup?error=password-invalid");
  if (password !== confirmPassword) redirect("/system-admin/setup?error=password-mismatch");
  if (await prisma.user.findUnique({ where: { email } })) redirect("/system-admin/setup?error=account-exists");

  const admin = await prisma.user.create({
    data: {
      displayName,
      email,
      passwordHash: await hashPassword(password),
      role: UserRole.SYSTEM_ADMIN,
    },
  });

  await setCurrentSession({ userId: admin.id, role: admin.role, authVersion: admin.authVersion });
  redirect("/system-admin/users?created=1");
}

export async function resetUserPassword(formData: FormData) {
  const admin = await getCurrentSystemAdmin();
  if (!admin) redirect("/system-admin/login");

  const targetUserId = formText(formData, "targetUserId");
  const password = passwordValue(formData, "password");
  const confirmPassword = passwordValue(formData, "confirmPassword");

  if (!isValidPassword(password)) redirect("/system-admin/users?error=password-invalid");
  if (password !== confirmPassword) redirect("/system-admin/users?error=password-mismatch");

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser || !isResettableUserRole(targetUser.role)) {
    redirect("/system-admin/users?error=user-not-found");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUser.id },
      data: {
        passwordHash: await hashPassword(password),
        authVersion: { increment: 1 },
      },
    }),
    prisma.passwordResetAudit.create({
      data: {
        actorId: admin.id,
        targetUserId: targetUser.id,
      },
    }),
  ]);

  redirect(`/system-admin/users?updated=${encodeURIComponent(targetUser.id)}`);
}
