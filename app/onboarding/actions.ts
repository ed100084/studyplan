"use server";

import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, isValidPassword } from "@/lib/password";
import { clearCurrentSession, getCurrentSession, setCurrentSession } from "@/lib/session";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalEmail(formData: FormData, key: string) {
  const value = textValue(formData, key).toLowerCase();
  return value.length > 0 ? value : undefined;
}

function passwordValue(formData: FormData) {
  const value = formData.get("password");
  return typeof value === "string" ? value : "";
}

function intValue(formData: FormData, key: string, fallback: number) {
  const value = Number.parseInt(textValue(formData, key), 10);
  return Number.isFinite(value) ? value : fallback;
}

function createClassCode(grade: number, className: string) {
  const normalizedClass = className.replace(/\D/g, "").slice(-2).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ALJ${grade}${normalizedClass}${suffix}`;
}

function normalizeStudentLinkCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

async function createStudentLinkCode(grade: number) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const linkCode = `SP${grade}${suffix}`;
    const existing = await prisma.studentProfile.findUnique({
      where: {
        linkCode,
      },
    });

    if (!existing) {
      return linkCode;
    }
  }

  throw new Error("Unable to create a unique student link code.");
}

async function linkGuardianToStudent(guardianId: string, rawLinkCode: string) {
  const linkCode = normalizeStudentLinkCode(rawLinkCode);

  if (!linkCode) {
    return null;
  }

  const student = await prisma.studentProfile.findUnique({
    where: {
      linkCode,
    },
  });

  if (!student) {
    return null;
  }

  await prisma.guardianStudent.upsert({
    where: {
      guardianId_studentId: {
        guardianId,
        studentId: student.id,
      },
    },
    update: {},
    create: {
      guardianId,
      studentId: student.id,
    },
  });

  return student;
}

async function getAlianAcademicYear() {
  const academicYear = await prisma.academicYear.findFirst({
    where: {
      year: "114",
      school: {
        shortName: "阿蓮國中",
      },
    },
  });

  if (!academicYear) {
    throw new Error("找不到阿蓮國中 114 學年度資料，請先執行 db:seed。");
  }

  return academicYear;
}

export async function createClassroom(formData: FormData) {
  const displayName = textValue(formData, "displayName") || "班級管理者";
  const email = optionalEmail(formData, "email");
  const grade = intValue(formData, "grade", 7);
  const className = textValue(formData, "className") || `${grade}01`;
  const requestedCode = textValue(formData, "classCode").toUpperCase();
  const password = passwordValue(formData);
  const classCode = requestedCode || createClassCode(grade, className);
  const academicYear = await getAlianAcademicYear();

  if (!email) redirect("/class-admin?error=email-required");
  if (!isValidPassword(password)) redirect("/class-admin?error=password-invalid");

  const existingClassroom = await prisma.classroom.findUnique({
    where: {
      code: classCode,
    },
  });

  if (existingClassroom) {
    redirect(`/class-admin?error=class-code-used&code=${encodeURIComponent(classCode)}`);
  }

  if (email) {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) redirect("/class-admin?error=account-exists");
  }

  const manager = await prisma.user.create({
    data: {
      displayName,
      email,
      passwordHash: await hashPassword(password),
      role: UserRole.CLASS_ADMIN,
    },
  });

  const classroom = await prisma.classroom.create({
    data: {
      academicYearId: academicYear.id,
      name: className,
      code: classCode,
      grade,
      managerId: manager.id,
    },
  });

  await setCurrentSession({
    userId: manager.id,
    role: manager.role,
    authVersion: manager.authVersion,
  });

  redirect(`/class-admin?created=1&code=${encodeURIComponent(classroom.code)}`);
}

export async function createStudent(formData: FormData) {
  const displayName = textValue(formData, "displayName") || "阿蓮國中學生";
  const email = optionalEmail(formData, "email");
  const grade = intValue(formData, "grade", 7);
  const seatNumber = intValue(formData, "seatNumber", 0);
  const classCode = textValue(formData, "classCode").toUpperCase();
  const password = passwordValue(formData);

  if (!email) redirect("/student?error=email-required");
  if (!isValidPassword(password)) redirect("/student?error=password-invalid");

  if (email) {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) redirect("/student?error=account-exists");
  }

  const student = await prisma.user.create({
    data: {
      displayName,
      email,
      passwordHash: await hashPassword(password),
      role: UserRole.STUDENT,
      studentProfile: {
        create: {
          grade,
          linkCode: await createStudentLinkCode(grade),
        },
      },
    },
    include: {
      studentProfile: true,
    },
  });

  let joined = false;
  if (classCode && student.studentProfile) {
    const classroom = await prisma.classroom.findUnique({
      where: {
        code: classCode,
      },
    });

    if (classroom) {
      await prisma.classMember.create({
        data: {
          classroomId: classroom.id,
          studentId: student.studentProfile.id,
          seatNumber: seatNumber > 0 ? seatNumber : null,
        },
      });
      joined = true;
    }
  }

  await setCurrentSession({
    userId: student.id,
    role: student.role,
    authVersion: student.authVersion,
  });

  redirect(`/student?created=1&joined=${joined ? "1" : "0"}`);
}

export async function createGuardian(formData: FormData) {
  const displayName = textValue(formData, "displayName") || "家長";
  const email = optionalEmail(formData, "email");
  const studentLinkCode = textValue(formData, "studentLinkCode");
  const password = passwordValue(formData);

  if (!email) redirect("/guardian?error=email-required");
  if (!isValidPassword(password)) redirect("/guardian?error=password-invalid");

  if (email) {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) redirect("/guardian?error=account-exists");
  }

  const guardian = await prisma.user.create({
    data: {
      displayName,
      email,
      passwordHash: await hashPassword(password),
      role: UserRole.GUARDIAN,
      guardianProfile: {
        create: {},
      },
    },
    include: {
      guardianProfile: true,
    },
  });

  let linkedStudentId = "";
  if (guardian.guardianProfile) {
    const linkedStudent = await linkGuardianToStudent(guardian.guardianProfile.id, studentLinkCode);
    linkedStudentId = linkedStudent?.id ?? "";
  }

  await setCurrentSession({
    userId: guardian.id,
    role: guardian.role,
    authVersion: guardian.authVersion,
  });

  redirect(`/guardian?created=1&linked=${linkedStudentId ? "1" : "0"}${linkedStudentId ? `&studentId=${linkedStudentId}` : ""}`);
}

export async function linkStudentToGuardian(formData: FormData) {
  const session = await getCurrentSession();
  const studentLinkCode = textValue(formData, "studentLinkCode");

  if (session?.role !== UserRole.GUARDIAN) {
    redirect("/guardian?error=guardian-required");
  }

  const guardian = await prisma.guardianProfile.findUnique({
    where: {
      userId: session.userId,
    },
  });

  if (!guardian) {
    redirect("/guardian?error=guardian-required");
  }

  const linkedStudent = await linkGuardianToStudent(guardian.id, studentLinkCode);

  if (!linkedStudent) {
    redirect("/guardian?error=student-code-not-found");
  }

  redirect(`/guardian?linked=1&studentId=${linkedStudent.id}`);
}

export async function signOut() {
  await clearCurrentSession();
  redirect("/");
}
