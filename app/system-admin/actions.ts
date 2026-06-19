"use server";

import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { hashPassword, isValidPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { secretsEqual } from "@/lib/secrets";
import { setCurrentSession } from "@/lib/session";
import {
  canReplaceExistingAccount,
  getCurrentSystemAdmin,
  isResettableUserRole,
  isValidAccountEmail,
  normalizeAccountEmail,
} from "@/lib/system-admin";

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
  const email = normalizeAccountEmail(formText(formData, "email"));
  const password = passwordValue(formData, "password");
  const confirmPassword = passwordValue(formData, "confirmPassword");
  const replaceExistingAccount = formData.get("replaceExistingAccount") === "yes";
  const replaceConfirmation = formText(formData, "replaceConfirmation");

  if (!email) redirect("/system-admin/setup?error=email-required");
  if (!isValidPassword(password)) redirect("/system-admin/setup?error=password-invalid");
  if (password !== confirmPassword) redirect("/system-admin/setup?error=password-mismatch");
  const existingAccount = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingAccount && !replaceExistingAccount) redirect("/system-admin/setup?error=account-exists");
  if (existingAccount && !canReplaceExistingAccount(replaceExistingAccount, replaceConfirmation)) {
    redirect("/system-admin/setup?error=replace-confirmation");
  }

  const passwordHash = await hashPassword(password);
  const admin = await prisma.$transaction(async (transaction) => {
    if (existingAccount) {
      await transaction.passwordResetAudit.deleteMany({
        where: {
          OR: [{ actorId: existingAccount.id }, { targetUserId: existingAccount.id }],
        },
      });
      await transaction.user.delete({ where: { id: existingAccount.id } });
    }

    return transaction.user.create({
      data: {
        displayName,
        email,
        passwordHash,
        role: UserRole.SYSTEM_ADMIN,
      },
    });
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

export async function updateUserEmail(formData: FormData) {
  const admin = await getCurrentSystemAdmin();
  if (!admin) redirect("/system-admin/login");

  const targetUserId = formText(formData, "targetUserId");
  const email = normalizeAccountEmail(formText(formData, "email"));

  if (!isValidAccountEmail(email)) redirect("/system-admin/users?error=email-invalid");

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser || !isResettableUserRole(targetUser.role)) {
    redirect("/system-admin/users?error=user-not-found");
  }

  if (targetUser.email === email) redirect("/system-admin/users?error=email-unchanged");

  const existingAccount = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingAccount && existingAccount.id !== targetUser.id) {
    redirect("/system-admin/users?error=email-exists");
  }

  await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      email,
      authVersion: { increment: 1 },
    },
  });

  redirect(`/system-admin/users?emailUpdated=${encodeURIComponent(targetUser.id)}`);
}
