"use server";

import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clearCurrentSession, setCurrentSession } from "@/lib/session";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalEmail(formData: FormData, key: string) {
  const value = textValue(formData, key).toLowerCase();
  return value.length > 0 ? value : undefined;
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
    throw new Error("找不到阿蓮國中 114 學年資料，請先執行 db:seed。");
  }

  return academicYear;
}

export async function createClassroom(formData: FormData) {
  const displayName = textValue(formData, "displayName") || "班級管理者";
  const email = optionalEmail(formData, "email");
  const grade = intValue(formData, "grade", 7);
  const className = textValue(formData, "className") || `${grade}01`;
  const requestedCode = textValue(formData, "classCode").toUpperCase();
  const classCode = requestedCode || createClassCode(grade, className);
  const academicYear = await getAlianAcademicYear();

  const manager = await prisma.user.create({
    data: {
      displayName,
      email,
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
  });

  redirect(`/class-admin?created=1&code=${encodeURIComponent(classroom.code)}`);
}

export async function createStudent(formData: FormData) {
  const displayName = textValue(formData, "displayName") || "阿蓮國中學生";
  const email = optionalEmail(formData, "email");
  const grade = intValue(formData, "grade", 7);
  const seatNumber = intValue(formData, "seatNumber", 0);
  const classCode = textValue(formData, "classCode").toUpperCase();

  const student = await prisma.user.create({
    data: {
      displayName,
      email,
      role: UserRole.STUDENT,
      studentProfile: {
        create: {
          grade,
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
  });

  redirect(`/student?created=1&joined=${joined ? "1" : "0"}`);
}

export async function createGuardian(formData: FormData) {
  const displayName = textValue(formData, "displayName") || "家長";
  const email = optionalEmail(formData, "email");
  const studentEmail = textValue(formData, "studentEmail").toLowerCase();

  const guardian = await prisma.user.create({
    data: {
      displayName,
      email,
      role: UserRole.GUARDIAN,
      guardianProfile: {
        create: {},
      },
    },
    include: {
      guardianProfile: true,
    },
  });

  let linked = false;
  if (studentEmail && guardian.guardianProfile) {
    const student = await prisma.user.findUnique({
      where: {
        email: studentEmail,
      },
      include: {
        studentProfile: true,
      },
    });

    if (student?.studentProfile) {
      await prisma.guardianStudent.create({
        data: {
          guardianId: guardian.guardianProfile.id,
          studentId: student.studentProfile.id,
        },
      });
      linked = true;
    }
  }

  await setCurrentSession({
    userId: guardian.id,
    role: guardian.role,
  });

  redirect(`/guardian?created=1&linked=${linked ? "1" : "0"}`);
}

export async function signOut() {
  await clearCurrentSession();
  redirect("/");
}
