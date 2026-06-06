"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FatigueLevel, FixedEventType, RecordSource, TaskStatus, TaskType, UserRole, Weekday } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function intValue(formData: FormData, key: string, fallback: number) {
  const value = Number.parseInt(textValue(formData, key), 10);
  return Number.isFinite(value) ? value : fallback;
}

function boolValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function enumValue<T extends Record<string, string>>(source: T, rawValue: string, fallback: T[keyof T]) {
  return Object.values(source).includes(rawValue) ? (rawValue as T[keyof T]) : fallback;
}

function taipeiDateValue(rawValue: string) {
  const value = rawValue || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
  return new Date(`${value}T00:00:00+08:00`);
}

function addQuery(path: string, query: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

async function getEditableStudent(studentId?: string) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/student?error=login-required");
  }

  if (session.role === UserRole.STUDENT) {
    const student = await prisma.studentProfile.findUnique({
      where: {
        userId: session.userId,
      },
    });

    if (!student) {
      redirect("/student?error=student-required");
    }

    return {
      student,
      source: RecordSource.STUDENT,
      redirectTo: "/student",
      actingUserId: session.userId,
    };
  }

  if (session.role === UserRole.GUARDIAN && studentId) {
    const link = await prisma.guardianStudent.findFirst({
      where: {
        studentId,
        guardian: {
          userId: session.userId,
        },
      },
      include: {
        student: true,
      },
    });

    if (!link) {
      redirect("/guardian?error=student-not-linked");
    }

    return {
      student: link.student,
      source: RecordSource.GUARDIAN,
      redirectTo: `/guardian?studentId=${link.student.id}`,
      actingUserId: session.userId,
    };
  }

  redirect("/guardian?error=student-required");
}

export async function createFixedEvent(formData: FormData) {
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);
  const type = enumValue(FixedEventType, textValue(formData, "type"), FixedEventType.OTHER);
  const weekday = enumValue(Weekday, textValue(formData, "weekday"), Weekday.MONDAY);
  const title = textValue(formData, "title") || "固定行程";
  const startTime = textValue(formData, "startTime") || "18:00";
  const endTime = textValue(formData, "endTime") || "18:30";
  const commuteMinutes = Math.max(0, intValue(formData, "commuteMinutes", 0));
  const note = textValue(formData, "note") || undefined;

  await prisma.fixedEvent.create({
    data: {
      studentId: editable.student.id,
      title,
      type,
      weekday,
      startTime,
      endTime,
      commuteMinutes,
      note,
    },
  });

  revalidatePath("/student");
  revalidatePath("/guardian");
  redirect(addQuery(editable.redirectTo, "schedule=1"));
}

export async function createTutoringSession(formData: FormData) {
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);
  const subjectName = textValue(formData, "subjectName") || "補習";
  const weekday = enumValue(Weekday, textValue(formData, "weekday"), Weekday.MONDAY);
  const startTime = textValue(formData, "startTime") || "18:00";
  const endTime = textValue(formData, "endTime") || "20:00";
  const commuteMinutes = Math.max(0, intValue(formData, "commuteMinutes", 0));
  const fatigueLevel = enumValue(FatigueLevel, textValue(formData, "fatigueLevel"), FatigueLevel.NORMAL);

  await prisma.tutoringSession.create({
    data: {
      studentId: editable.student.id,
      subjectName,
      weekday,
      startTime,
      endTime,
      commuteMinutes,
      fatigueLevel,
      hasHomework: boolValue(formData, "hasHomework"),
    },
  });

  revalidatePath("/student");
  revalidatePath("/guardian");
  redirect(addQuery(editable.redirectTo, "schedule=1"));
}

export async function createStudyTask(formData: FormData) {
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);
  const subjectName = textValue(formData, "subjectName");
  const title = textValue(formData, "title") || "讀書任務";
  const description = textValue(formData, "description") || undefined;
  const type = enumValue(TaskType, textValue(formData, "type"), TaskType.SCHOOL_HOMEWORK);
  const plannedDate = taipeiDateValue(textValue(formData, "plannedDate"));
  const estimatedMinutes = Math.max(10, intValue(formData, "estimatedMinutes", 30));
  const priority = Math.min(5, Math.max(1, intValue(formData, "priority", 3)));

  const subject = subjectName
    ? await prisma.subject.upsert({
        where: {
          name: subjectName,
        },
        update: {},
        create: {
          name: subjectName,
        },
      })
    : null;

  await prisma.studyTask.create({
    data: {
      studentId: editable.student.id,
      subjectId: subject?.id,
      title,
      description,
      type,
      plannedDate,
      estimatedMinutes,
      priority,
      source: editable.source,
    },
  });

  revalidatePath("/student");
  revalidatePath("/guardian");
  redirect(addQuery(editable.redirectTo, "schedule=1"));
}

export async function updateTaskStatus(formData: FormData) {
  const taskId = textValue(formData, "taskId");
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);
  const status = enumValue(TaskStatus, textValue(formData, "status"), TaskStatus.DONE);
  const actualMinutes = intValue(formData, "actualMinutes", 0);
  const difficulty = intValue(formData, "difficulty", 0);
  const reason = textValue(formData, "reason") || undefined;

  const task = await prisma.studyTask.findFirst({
    where: {
      id: taskId,
      studentId: editable.student.id,
    },
  });

  if (!task) {
    redirect(addQuery(editable.redirectTo, "error=task-not-found"));
  }

  await prisma.studyTask.update({
    where: {
      id: task.id,
    },
    data: {
      status,
      logs: {
        create: {
          userId: editable.actingUserId,
          status,
          actualMinutes: actualMinutes > 0 ? actualMinutes : null,
          difficulty: difficulty > 0 ? difficulty : null,
          reason,
          source: editable.source,
        },
      },
    },
  });

  revalidatePath("/student");
  revalidatePath("/guardian");
  redirect(addQuery(editable.redirectTo, "schedule=1"));
}
