"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CalendarEventType,
  FatigueLevel,
  FixedEventType,
  RecordSource,
  ReviewPlanRevisionTrigger,
  ScheduleRunTrigger,
  TaskStatus,
  TaskType,
  UserRole,
  Weekday,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { formatDateInput, getCurrentDay, getDayRange, getRequestTimeZone, zonedDateStart } from "@/lib/timezone";
import { buildExamReviewTaskDrafts } from "@/lib/exam-review-planner";
import { buildTodaySchedule } from "@/lib/scheduler/today";
import { tutoringSessionFallsOnDate } from "@/lib/tutoring-sessions";

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

async function userDateValue(rawValue: string) {
  const timeZone = await getRequestTimeZone();
  const value = rawValue || formatDateInput(new Date(), timeZone);
  return zonedDateStart(value, timeZone);
}

function optionalDateValue(rawValue: string, timeZone: string) {
  return rawValue ? zonedDateStart(rawValue, timeZone) : null;
}

function activeTutoringDateWhere(date: Date) {
  return {
    AND: [
      {
        OR: [{ startDate: null }, { startDate: { lte: date } }],
      },
      {
        OR: [{ endDate: null }, { endDate: { gte: date } }],
      },
    ],
  };
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

function addDays(date: Date, days: number, timeZone: string) {
  const dateValue = formatDateInput(date, timeZone);
  const [year, month, day] = dateValue.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  const nextValue = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(next);

  return zonedDateStart(nextValue, timeZone);
}

function addQuery(path: string, query: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

function laterDate(first: string, second: string) {
  return first > second ? first : second;
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
  const timeZone = await getRequestTimeZone();
  const subjectName = textValue(formData, "subjectName") || "補習";
  const weekday = enumValue(Weekday, textValue(formData, "weekday"), Weekday.MONDAY);
  const rawStartDate = textValue(formData, "startDate");
  const rawEndDate = textValue(formData, "endDate");
  const startTime = textValue(formData, "startTime") || "18:00";
  const endTime = textValue(formData, "endTime") || "20:00";
  const commuteMinutes = Math.max(0, intValue(formData, "commuteMinutes", 0));
  const fatigueLevel = enumValue(FatigueLevel, textValue(formData, "fatigueLevel"), FatigueLevel.NORMAL);

  if (rawStartDate && rawEndDate && rawStartDate > rawEndDate) {
    redirect(addQuery(editable.redirectTo, "error=tutoring-date-range"));
  }

  await prisma.tutoringSession.create({
    data: {
      studentId: editable.student.id,
      subjectName,
      weekday,
      startDate: optionalDateValue(rawStartDate, timeZone),
      endDate: optionalDateValue(rawEndDate, timeZone),
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
  const plannedDate = await userDateValue(textValue(formData, "plannedDate"));
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

export async function createCalendarEvent(formData: FormData) {
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);
  const title = textValue(formData, "title") || "學校活動";
  const type = enumValue(CalendarEventType, textValue(formData, "type"), CalendarEventType.SCHOOL_EVENT);
  const startDate = await userDateValue(textValue(formData, "startDate"));
  const rawEndDate = textValue(formData, "endDate");
  const endDate = rawEndDate ? await userDateValue(rawEndDate) : null;
  const subjectName = textValue(formData, "subjectName") || null;
  const note = textValue(formData, "note") || null;

  await prisma.calendarEvent.create({
    data: {
      studentId: editable.student.id,
      title,
      type,
      startDate,
      endDate,
      subjectName,
      note,
      source: editable.source,
    },
  });

  revalidatePath("/student");
  revalidatePath("/guardian");
  redirect(addQuery(editable.redirectTo, "schedule=1"));
}

async function redistributeExamReviewPlan(
  planId: string,
  timeZone: string,
  earliestDate: string,
  trigger: ReviewPlanRevisionTrigger,
) {
  const plan = await prisma.examReviewPlan.findUnique({
    where: { id: planId },
    include: {
      student: {
        include: {
          fixedEvents: true,
          tutoringSessions: true,
          calendarEvents: true,
        },
      },
      tasks: {
        include: { logs: true },
      },
    },
  });

  if (!plan) return;

  const completedMinutes = plan.tasks.reduce((total, task) => {
    if (task.status === TaskStatus.DONE) return total + task.estimatedMinutes;
    if (task.status !== TaskStatus.PARTIAL) return total;

    const actualMinutes = task.logs.reduce((sum, log) => sum + (log.actualMinutes ?? 0), 0);
    return total + Math.min(task.estimatedMinutes, actualMinutes);
  }, 0);
  const remainingMinutes = Math.max(0, plan.totalMinutes - completedMinutes);
  const examDate = formatDateInput(plan.examDate, timeZone);
  const startDate = laterDate(formatDateInput(plan.startDate, timeZone), earliestDate);
  const drafts = buildExamReviewTaskDrafts({
    startDate,
    examDate,
    remainingMinutes,
    sessionMinutes: plan.sessionMinutes,
    fixedEvents: plan.student.fixedEvents,
    tutoringSessions: plan.student.tutoringSessions.map((session) => ({
      id: session.id,
      subjectName: session.subjectName,
      weekday: session.weekday,
      startDate: session.startDate ? formatDateInput(session.startDate, timeZone) : null,
      endDate: session.endDate ? formatDateInput(session.endDate, timeZone) : null,
      startTime: session.startTime,
      endTime: session.endTime,
      commuteMinutes: session.commuteMinutes,
      fatigueLevel: session.fatigueLevel,
      hasHomework: session.hasHomework,
    })),
    calendarEvents: plan.student.calendarEvents.map((event) => ({
      id: event.id,
      type: event.type,
      startDate: formatDateInput(event.startDate, timeZone),
      endDate: event.endDate ? formatDateInput(event.endDate, timeZone) : null,
    })),
  });

  await prisma.$transaction(async (transaction) => {
    const latestRevision = await transaction.examReviewPlanRevision.aggregate({
      where: { examReviewPlanId: plan.id },
      _max: { revision: true },
    });

    await transaction.studyTask.deleteMany({
      where: {
        examReviewPlanId: plan.id,
        status: TaskStatus.PLANNED,
      },
    });
    if (drafts.tasks.length > 0) {
      await transaction.studyTask.createMany({
        data: drafts.tasks.map((draft) => ({
          studentId: plan.studentId,
          subjectId: plan.subjectId,
          examReviewPlanId: plan.id,
          title: `${plan.title}（第 ${draft.sequence} 次）`,
          description: plan.scope,
          type: TaskType.EXAM_SPRINT,
          status: TaskStatus.PLANNED,
          plannedDate: zonedDateStart(draft.plannedDate, timeZone),
          estimatedMinutes: draft.estimatedMinutes,
          priority: plan.priority,
          source: RecordSource.SYSTEM,
        })),
      });
    }

    await transaction.examReviewPlanRevision.create({
      data: {
        examReviewPlanId: plan.id,
        revision: (latestRevision._max.revision ?? 0) + 1,
        trigger,
        remainingMinutes,
        scheduledMinutes: drafts.scheduledMinutes,
        unscheduledMinutes: drafts.unscheduledMinutes,
        taskCount: drafts.tasks.length,
        snapshot: {
          startDate,
          examDate,
          availableDayCount: drafts.availableDayCount,
          tasks: drafts.tasks,
        },
      },
    });
  });
}

export async function createExamReviewPlan(formData: FormData) {
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);
  const timeZone = await getRequestTimeZone();
  const today = formatDateInput(new Date(), timeZone);
  const calendarEventId = textValue(formData, "calendarEventId");
  const event = await prisma.calendarEvent.findFirst({
    where: {
      id: calendarEventId,
      studentId: editable.student.id,
      type: {
        in: [CalendarEventType.SECTION_EXAM, CalendarEventType.MOCK_EXAM, CalendarEventType.ENTRANCE_EXAM],
      },
    },
  });

  if (!event) {
    redirect(addQuery(editable.redirectTo, "error=exam-event-not-found"));
  }

  const examDate = formatDateInput(event.startDate, timeZone);
  const startDate = laterDate(textValue(formData, "startDate") || today, today);
  if (startDate >= examDate) {
    redirect(addQuery(editable.redirectTo, "error=exam-plan-date"));
  }

  const subjectName = textValue(formData, "subjectName") || event.subjectName || "綜合複習";
  const subjectId = await getSubjectId(subjectName);
  const existingPlan = await prisma.examReviewPlan.findFirst({
    where: {
      studentId: editable.student.id,
      calendarEventId: event.id,
      subjectId,
    },
  });
  if (existingPlan) {
    redirect(addQuery(editable.redirectTo, "error=exam-plan-exists"));
  }
  const title = textValue(formData, "title") || event.title;
  const scope = textValue(formData, "scope") || event.note || null;
  const totalMinutes = Math.min(5000, Math.max(30, Math.ceil(intValue(formData, "totalMinutes", 300) / 5) * 5));
  const sessionMinutes = Math.min(180, Math.max(10, Math.ceil(intValue(formData, "sessionMinutes", 30) / 5) * 5));
  const priority = Math.min(5, Math.max(1, intValue(formData, "priority", 4)));

  const plan = await prisma.examReviewPlan.create({
    data: {
      studentId: editable.student.id,
      calendarEventId: event.id,
      subjectId,
      title,
      scope,
      totalMinutes,
      sessionMinutes,
      priority,
      startDate: zonedDateStart(startDate, timeZone),
      examDate: event.startDate,
      source: editable.source,
    },
  });

  await redistributeExamReviewPlan(plan.id, timeZone, startDate, ReviewPlanRevisionTrigger.CREATED);
  revalidatePath("/student");
  revalidatePath("/guardian");
  redirect(addQuery(editable.redirectTo, "examPlan=1"));
}

export async function redistributeExamReviewPlanAction(formData: FormData) {
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);
  const planId = textValue(formData, "examReviewPlanId");
  const plan = await prisma.examReviewPlan.findFirst({ where: { id: planId, studentId: editable.student.id } });
  if (!plan) redirect(addQuery(editable.redirectTo, "error=exam-plan-not-found"));

  const timeZone = await getRequestTimeZone();
  await redistributeExamReviewPlan(
    plan.id,
    timeZone,
    formatDateInput(new Date(), timeZone),
    ReviewPlanRevisionTrigger.MANUAL_REDISTRIBUTION,
  );
  revalidatePath("/student");
  revalidatePath("/guardian");
  redirect(addQuery(editable.redirectTo, "examPlan=1"));
}

export async function deleteExamReviewPlan(formData: FormData) {
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);
  const planId = textValue(formData, "examReviewPlanId");
  const plan = await prisma.examReviewPlan.findFirst({ where: { id: planId, studentId: editable.student.id } });
  if (!plan) redirect(addQuery(editable.redirectTo, "error=exam-plan-not-found"));

  await prisma.examReviewPlan.delete({ where: { id: plan.id } });
  revalidatePath("/student");
  revalidatePath("/guardian");
  redirect(addQuery(editable.redirectTo, "examPlan=1"));
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
  const timeZone = await getRequestTimeZone();
  const session = await prisma.tutoringSession.findFirst({
    where: {
      id: tutoringSessionId,
      studentId: editable.student.id,
    },
  });

  if (!session) {
    redirect(addQuery(editable.redirectTo, "error=tutoring-session-not-found"));
  }

  const rawStartDate = textValue(formData, "startDate");
  const rawEndDate = textValue(formData, "endDate");
  if (rawStartDate && rawEndDate && rawStartDate > rawEndDate) {
    redirect(addQuery(editable.redirectTo, "error=tutoring-date-range"));
  }

  await prisma.tutoringSession.update({
    where: {
      id: session.id,
    },
    data: {
      subjectName: textValue(formData, "subjectName") || session.subjectName,
      weekday: enumValue(Weekday, textValue(formData, "weekday"), session.weekday),
      startDate: optionalDateValue(rawStartDate, timeZone),
      endDate: optionalDateValue(rawEndDate, timeZone),
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
      plannedDate: await userDateValue(textValue(formData, "plannedDate")),
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
  const timeZone = await getRequestTimeZone();
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
          plannedDate: addDays(task.plannedDate, 1, timeZone),
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

  if (
    task.examReviewPlanId &&
    (status === TaskStatus.DONE || status === TaskStatus.PARTIAL || status === TaskStatus.SKIPPED)
  ) {
    await redistributeExamReviewPlan(
      task.examReviewPlanId,
      timeZone,
      formatDateInput(new Date(), timeZone),
      ReviewPlanRevisionTrigger.TASK_PROGRESS,
    );
  }

  revalidatePath("/student");
  revalidatePath("/guardian");
  redirect(addQuery(editable.redirectTo, "schedule=1"));
}

export async function saveTodaySchedule(formData: FormData) {
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);
  const trigger = enumValue(ScheduleRunTrigger, textValue(formData, "trigger"), ScheduleRunTrigger.SAVED);
  const timeZone = await getRequestTimeZone();
  const today = getCurrentDay(timeZone);
  const range = getDayRange(today.date, timeZone);
  const student = await prisma.studentProfile.findUnique({
    where: { id: editable.student.id },
    include: {
      fixedEvents: { where: { weekday: today.weekday } },
      tutoringSessions: { where: { weekday: today.weekday, ...activeTutoringDateWhere(range.start) } },
      studyTasks: {
        where: {
          plannedDate: { gte: range.start, lt: range.end },
          status: TaskStatus.PLANNED,
        },
        include: { subject: true },
      },
    },
  });

  if (!student) redirect(addQuery(editable.redirectTo, "error=student-required"));

  const schedule = buildTodaySchedule({
    fixedEvents: student.fixedEvents,
    tutoringSessions: student.tutoringSessions.filter((session) =>
      tutoringSessionFallsOnDate(session, today.date, timeZone),
    ),
    tasks: student.studyTasks.map((task) => ({
      id: task.id,
      title: task.title,
      subjectName: task.subject?.name,
      type: task.type,
      estimatedMinutes: task.estimatedMinutes,
      priority: task.priority,
    })),
  });

  await prisma.$transaction(async (transaction) => {
    const latestRevision = await transaction.scheduleRun.aggregate({
      where: { studentId: student.id, scheduleDate: range.start },
      _max: { revision: true },
    });

    await transaction.scheduleRun.create({
      data: {
        studentId: student.id,
        scheduleDate: range.start,
        revision: (latestRevision._max.revision ?? 0) + 1,
        trigger,
        availableMinutes: schedule.availableMinutes,
        scheduledStudyMinutes: schedule.scheduledStudyMinutes,
        snapshot: JSON.parse(JSON.stringify({ scheduled: schedule.scheduled, unplaced: schedule.unplaced })),
        source: editable.source,
      },
    });
  });

  revalidatePath("/student");
  revalidatePath("/guardian");
  redirect(addQuery(editable.redirectTo, "scheduleHistory=1"));
}

export async function moveTasksToTomorrow(formData: FormData) {
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);
  const timeZone = await getRequestTimeZone();
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
          plannedDate: addDays(task.plannedDate, 1, timeZone),
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

export async function deleteCalendarEvent(formData: FormData) {
  const calendarEventId = textValue(formData, "calendarEventId");
  const studentId = textValue(formData, "studentId") || undefined;
  const editable = await getEditableStudent(studentId);
  const event = await prisma.calendarEvent.findFirst({
    where: {
      id: calendarEventId,
      studentId: editable.student.id,
    },
  });

  if (!event) {
    redirect(addQuery(editable.redirectTo, "error=calendar-event-not-found"));
  }

  if (event.source === RecordSource.TEACHER) {
    redirect(addQuery(editable.redirectTo, "error=teacher-event-readonly"));
  }

  await prisma.calendarEvent.delete({
    where: {
      id: event.id,
    },
  });

  revalidatePath("/student");
  revalidatePath("/guardian");
  redirect(addQuery(editable.redirectTo, "schedule=1"));
}
