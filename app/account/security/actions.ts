"use server";

import { redirect } from "next/navigation";
import { hashPassword, isValidPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, setCurrentSession } from "@/lib/session";

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function changePassword(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const currentPassword = formText(formData, "currentPassword");
  const newPassword = formText(formData, "newPassword");
  const confirmPassword = formText(formData, "confirmPassword");

  if (!isValidPassword(newPassword)) redirect("/account/security?error=password-invalid");
  if (newPassword !== confirmPassword) redirect("/account/security?error=password-mismatch");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
    redirect("/account/security?error=current-password");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      authVersion: { increment: 1 },
    },
  });

  await setCurrentSession({ userId: updated.id, role: updated.role, authVersion: updated.authVersion });
  redirect("/account/security?updated=1");
}
