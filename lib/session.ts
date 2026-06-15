import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { UserRole } from "@prisma/client";

export const SESSION_COOKIE = "studyplan_session";
const SESSION_VERSION = "v1";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type StudyPlanSession = {
  userId: string;
  role: UserRole;
};

type SessionPayload = StudyPlanSession & {
  expiresAt: number;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret && (process.env.NODE_ENV !== "production" || secret.length >= 32)) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must contain at least 32 characters in production.");
  }

  return "studyplan-development-only-session-secret";
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
}

export function createSessionToken(session: StudyPlanSession, now = Date.now()) {
  const payload: SessionPayload = {
    ...session,
    expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${SESSION_VERSION}.${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function parseSessionToken(value: string, now = Date.now()): StudyPlanSession | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;

  const [version, encodedPayload, signature] = parts;
  if (version !== SESSION_VERSION || !encodedPayload || !signature) return null;

  const expectedSignature = Buffer.from(signPayload(encodedPayload));
  const actualSignature = Buffer.from(signature);
  if (expectedSignature.length !== actualSignature.length || !timingSafeEqual(expectedSignature, actualSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (
      typeof payload.userId !== "string" ||
      typeof payload.role !== "string" ||
      !Object.values(UserRole).includes(payload.role as UserRole) ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= now
    ) {
      return null;
    }

    return { userId: payload.userId, role: payload.role as UserRole };
  } catch {
    return null;
  }
}

export async function setCurrentSession(session: StudyPlanSession) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function getCurrentSession(): Promise<StudyPlanSession | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;

  if (!value) {
    return null;
  }

  return parseSessionToken(value);
}

export async function clearCurrentSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
