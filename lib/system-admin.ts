import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export const resettableUserRoles = [UserRole.STUDENT, UserRole.GUARDIAN, UserRole.CLASS_ADMIN] as const;
export const replaceAccountConfirmation = "刪除舊帳號";

export function isResettableUserRole(role: UserRole) {
  return resettableUserRoles.some((candidate) => candidate === role);
}

export function canReplaceExistingAccount(enabled: boolean, confirmation: string) {
  return enabled && confirmation === replaceAccountConfirmation;
}

export async function getCurrentSystemAdmin() {
  const session = await getCurrentSession();
  if (session?.role !== UserRole.SYSTEM_ADMIN) return null;

  return prisma.user.findFirst({
    where: { id: session.userId, role: UserRole.SYSTEM_ADMIN },
  });
}
