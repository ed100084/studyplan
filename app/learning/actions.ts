"use server";

import { RecordSource, TaskType, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { formatDateInput, getRequestTimeZone, zonedDateStart } from "@/lib/timezone";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(formData: FormData, key: string, fallback: number) {
  const rawValue = textValue(formData, key);
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
}

function intValue(formData: FormData, key: string, fallback: number) {
  return Math.round(numberValue(formData, key, fallback));
}

function addQuery(path: string, query: string) {
  const [pathWithoutHash, hash = ""] = path.split("#");
  const [pathname, search = ""] = pathWithoutHash.split("?");
  const params = new URLSearchParams(search);
  new URLSearchParams(query).forEach((value, key) => params.set(key, value));
  const nextSearch = params.toString();

  return `${pathname}${nextSearch ? `?${nextSearch}` : ""}${hash ? `#${hash}` : ""}`;
}

function safeReturnTo(formData: FormData, fallback: string) {
  const value = textValue(formData, "returnTo");
  return value.startsWith("/student") || value.startsWith("/guardian") ? value : fallback;
}

function redirectBack(formData: FormData, fallback: string, query: string): never {
  redirect(addQuery(safeReturnTo(formData, fallback), query));
}

async function getEditableStudent(studentId?: string) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role === UserRole.STUDENT) {
    const student = await prisma.studentProfile.findUnique({
      where: { userId: session.userId },
    });

    if (!student) {
      redirect("/student?error=student-required");
    }

    return {
      student,
      source: RecordSource.STUDENT,
      redirectTo: "/student",
    };
  }

  if (session.role === UserRole.GUARDIAN && studentId) {
    const link = await prisma.guardianStudent.findFirst({
      where: {
        studentId,
        guardian: { userId: session.userId },
      },
      include: { student: true },
    });

    if (!link) {
      redirect("/guardian?error=student-not-linked");
    }

    return {
      student: link.student,
      source: RecordSource.GUARDIAN,
      redirectTo: `/guardian?studentId=${link.student.id}`,
    };
  }

  redirect("/guardian?error=student-required");
}

async function getSubjectId(subjectName: string) {
  const subject = await prisma.subject.upsert({
    where: { name: subjectName },
    update: {},
    create: { name: subjectName },
  });

  return subject.id;
}

async function dateValue(rawValue: string) {
  const timeZone = await getRequestTimeZone();
  const value = rawValue || formatDateInput(new Date(), timeZone);
  return zonedDateStart(value, timeZone);
}

function refreshLearningPages() {
  revalidatePath("/student");
  revalidatePath("/guardian");
}

export async function createScore(formData: FormData) {
  const editable = await getEditableStudent(textValue(formData, "studentId") || undefined);
  const subjectName = textValue(formData, "subjectName");
  const value = numberValue(formData, "value", Number.NaN);

  if (!subjectName || !Number.isFinite(value) || value < 0 || value > 100) {
    redirectBack(formData, editable.redirectTo, "error=invalid-score");
  }

  const subjectId = await getSubjectId(subjectName);

  await prisma.score.create({
    data: {
      studentId: editable.student.id,
      subjectId,
      value,
      source: editable.source,
      takenAt: await dateValue(textValue(formData, "takenAt")),
    },
  });

  refreshLearningPages();
  redirectBack(formData, editable.redirectTo, "learning=1");
}

export async function deleteScore(formData: FormData) {
  const editable = await getEditableStudent(textValue(formData, "studentId") || undefined);
  const scoreId = textValue(formData, "scoreId");

  await prisma.score.deleteMany({
    where: {
      id: scoreId,
      studentId: editable.student.id,
    },
  });

  refreshLearningPages();
  redirectBack(formData, editable.redirectTo, "learning=1");
}

export async function createWeakPoint(formData: FormData) {
  const editable = await getEditableStudent(textValue(formData, "studentId") || undefined);
  const subjectName = textValue(formData, "subjectName");
  const title = textValue(formData, "title");

  if (!subjectName || !title) {
    redirectBack(formData, editable.redirectTo, "error=invalid-weak-point");
  }

  const subjectId = await getSubjectId(subjectName);
  const wrongCount = Math.max(1, intValue(formData, "wrongCount", 1));
  const reason = textValue(formData, "reason") || undefined;
  const createTask = formData.get("createTask") === "on";
  const plannedDate = createTask
    ? await dateValue(textValue(formData, "plannedDate"))
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.weakPoint.create({
      data: {
        studentId: editable.student.id,
        subjectId,
        title,
        wrongCount,
        reason,
        source: editable.source,
      },
    });

    if (createTask) {
      await tx.studyTask.create({
        data: {
          studentId: editable.student.id,
          subjectId,
          title: `弱點補強：${title}`,
          description: reason,
          type: TaskType.WEAK_POINT,
          plannedDate: plannedDate!,
          estimatedMinutes: Math.max(10, intValue(formData, "estimatedMinutes", 30)),
          priority: 4,
          source: editable.source,
        },
      });
    }
  });

  refreshLearningPages();
  redirectBack(formData, editable.redirectTo, "learning=1");
}

export async function deleteWeakPoint(formData: FormData) {
  const editable = await getEditableStudent(textValue(formData, "studentId") || undefined);
  const weakPointId = textValue(formData, "weakPointId");

  await prisma.weakPoint.deleteMany({
    where: {
      id: weakPointId,
      studentId: editable.student.id,
    },
  });

  refreshLearningPages();
  redirectBack(formData, editable.redirectTo, "learning=1");
}
