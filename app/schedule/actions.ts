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

async function getSubjectId(subjectName: string) {
  if (!subjectName) {
    return null;
  }

  const subject = await prisma.subject.upsert({
    where: {
      name: subjectName,
    },
    update: {},
    create: {
      name: subjectName,
    },
  });

  return subject.id;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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

  const subjectId = await getSubjectId(subjectName);

  await prisma.studyTask.create({
    data: {
      studentId: editable.student.id,
      subjectId,
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

export async function updateFixedEvent(formData: FormData) {
  const fixedEventId = textValue(formData, "fixedEventId");
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);
  const event = await prisma.fixedEvent.findFirst({
    where: {
      id: fixedEventId,
      studentId: editable.student.id,
    },
  });

  if (!event) {
    redirect(addQuery(editable.redirectTo, "error=fixed-event-not-found"));
  }

  await prisma.fixedEvent.update({
    where: {
      id: event.id,
    },
    data: {
      title: textValue(formData, "title") || event.title,
      type: enumValue(FixedEventType, textValue(formData, "type"), event.type),
      weekday: enumValue(Weekday, textValue(formData, "weekday"), event.weekday),
      startTime: textValue(formData, "startTime") || event.startTime,
      endTime: textValue(formData, "endTime") || event.endTime,
      commuteMinutes: Math.max(0, intValue(formData, "commuteMinutes", event.commuteMinutes)),
      note: textValue(formData, "note") || null,
    },
  });

  revalidatePath("/student");
  revalidatePath("/guardian");
  redirect(addQuery(editable.redirectTo, "schedule=1"));
}

export async function updateTutoringSession(formData: FormData) {
  const tutoringSessionId = textValue(formData, "tutoringSessionId");
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);
  const session = await prisma.tutoringSession.findFirst({
    where: {
      id: tutoringSessionId,
      studentId: editable.student.id,
    },
  });

  if (!session) {
    redirect(addQuery(editable.redirectTo, "error=tutoring-session-not-found"));
  }

  await prisma.tutoringSession.update({
    where: {
      id: session.id,
    },
    data: {
      subjectName: textValue(formData, "subjectName") || session.subjectName,
      weekday: enumValue(Weekday, textValue(formData, "weekday"), session.weekday),
      startTime: textValue(formData, "startTime") || session.startTime,
      endTime: textValue(formData, "endTime") || session.endTime,
      commuteMinutes: Math.max(0, intValue(formData, "commuteMinutes", session.commuteMinutes)),
      fatigueLevel: enumValue(FatigueLevel, textValue(formData, "fatigueLevel"), session.fatigueLevel),
      hasHomework: boolValue(formData, "hasHomework"),
    },
  });

  revalidatePath("/student");
  revalidatePath("/guardian");
  redirect(addQuery(editable.redirectTo, "schedule=1"));
}

export async function updateStudyTask(formData: FormData) {
  const taskId = textValue(formData, "taskId");
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);
  const task = await prisma.studyTask.findFirst({
    where: {
      id: taskId,
      studentId: editable.student.id,
    },
  });

  if (!task) {
    redirect(addQuery(editable.redirectTo, "error=task-not-found"));
  }

  const subjectId = await getSubjectId(textValue(formData, "subjectName"));

  await prisma.studyTask.update({
    where: {
      id: task.id,
    },
    data: {
      subjectId,
      title: textValue(formData, "title") || task.title,
      description: textValue(formData, "description") || null,
      type: enumValue(TaskType, textValue(formData, "type"), task.type),
      plannedDate: taipeiDateValue(textValue(formData, "plannedDate")),
      estimatedMinutes: Math.max(10, intValue(formData, "estimatedMinutes", task.estimatedMinutes)),
      priority: Math.min(5, Math.max(1, intValue(formData, "priority", task.priority))),
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

  const taskUpdate =
    status === TaskStatus.RESCHEDULED
      ? {
          status: TaskStatus.PLANNED,
          plannedDate: addDays(task.plannedDate, 1),
        }
      : {
          status,
        };

  await prisma.studyTask.update({
    where: {
      id: task.id,
    },
    data: {
      ...taskUpdate,
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

export async function moveTasksToTomorrow(formData: FormData) {
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);
  const taskIds = formData
    .getAll("taskId")
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  if (taskIds.length === 0) {
    redirect(addQuery(editable.redirectTo, "schedule=1"));
  }

  const tasks = await prisma.studyTask.findMany({
    where: {
      id: {
        in: taskIds,
      },
      studentId: editable.student.id,
      status: TaskStatus.PLANNED,
    },
  });

  await prisma.$transaction(
    tasks.map((task) =>
      prisma.studyTask.update({
        where: {
          id: task.id,
        },
        data: {
          plannedDate: addDays(task.plannedDate, 1),
          status: TaskStatus.PLANNED,
          logs: {
            create: {
              userId: editable.actingUserId,
              status: TaskStatus.RESCHEDULED,
              reason: "Moved from today's unplaced list to tomorrow.",
              source: editable.source,
            },
          },
        },
      }),
    ),
  );

  revalidatePath("/student");
  revalidatePath("/guardian");
  redirect(addQuery(editable.redirectTo, "schedule=1"));
}

export async function deleteFixedEvent(formData: FormData) {
  const fixedEventId = textValue(formData, "fixedEventId");
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);

  const event = await prisma.fixedEvent.findFirst({
    where: {
      id: fixedEventId,
      studentId: editable.student.id,
    },
  });

  if (!event) {
    redirect(addQuery(editable.redirectTo, "error=fixed-event-not-found"));
  }

  await prisma.fixedEvent.delete({
    where: {
      id: event.id,
    },
  });

  revalidatePath("/student");
  revalidatePath("/guardian");
  redirect(addQuery(editable.redirectTo, "schedule=1"));
}

export async function deleteTutoringSession(formData: FormData) {
  const tutoringSessionId = textValue(formData, "tutoringSessionId");
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);

  const session = await prisma.tutoringSession.findFirst({
    where: {
      id: tutoringSessionId,
      studentId: editable.student.id,
    },
  });

  if (!session) {
    redirect(addQuery(editable.redirectTo, "error=tutoring-session-not-found"));
  }

  await prisma.tutoringSession.delete({
    where: {
      id: session.id,
    },
  });

  revalidatePath("/student");
  revalidatePath("/guardian");
  redirect(addQuery(editable.redirectTo, "schedule=1"));
}

export async function deleteStudyTask(formData: FormData) {
  const taskId = textValue(formData, "taskId");
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);

  const task = await prisma.studyTask.findFirst({
    where: {
      id: taskId,
      studentId: editable.student.id,
    },
  });

  if (!task) {
    redirect(addQuery(editable.redirectTo, "error=task-not-found"));
  }

  await prisma.studyTask.delete({
    where: {
      id: task.id,
    },
  });

  revalidatePath("/student");
  revalidatePath("/guardian");
  redirect(addQuery(editable.redirectTo, "schedule=1"));
}
