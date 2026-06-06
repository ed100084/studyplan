import { cookies } from "next/headers";
import { UserRole } from "@prisma/client";

const SESSION_COOKIE = "studyplan_session";

export type StudyPlanSession = {
  userId: string;
  role: UserRole;
};

export async function setCurrentSession(session: StudyPlanSession) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, `${session.role}:${session.userId}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getCurrentSession(): Promise<StudyPlanSession | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;

  if (!value) {
    return null;
  }

  const [role, userId] = value.split(":");
  if (!role || !userId || !Object.values(UserRole).includes(role as UserRole)) {
    return null;
  }

  return {
    role: role as UserRole,
    userId,
  };
}

export async function clearCurrentSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

