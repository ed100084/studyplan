"use server";

import { redirect } from "next/navigation";
import { CalendarEventType, RecordSource, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { formatDateInput, getRequestTimeZone, zonedDateStart } from "@/lib/timezone";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function enumValue<T extends Record<string, string>>(source: T, rawValue: string, fallback: T[keyof T]) {
  return Object.values(source).includes(rawValue) ? (rawValue as T[keyof T]) : fallback;
}

async function userDateValue(rawValue: string) {
  const timeZone = await getRequestTimeZone();
  const value = rawValue || formatDateInput(new Date(), timeZone);
  return zonedDateStart(value, timeZone);
}

export async function createClassCalendarEvent(formData: FormData) {
  const session = await getCurrentSession();

  if (session?.role !== UserRole.CLASS_ADMIN) {
    redirect("/class-admin?error=class-admin-required");
  }

  const classroomId = textValue(formData, "classroomId");
  const classroom = await prisma.classroom.findFirst({
    where: {
      id: classroomId,
      managerId: session.userId,
    },
    include: {
      members: true,
    },
  });

  if (!classroom) {
    redirect("/class-admin?error=class-not-found");
  }

  if (classroom.members.length === 0) {
    redirect("/class-admin?error=no-class-members");
  }

  const title = textValue(formData, "title") || "班級活動";
  const type = enumValue(CalendarEventType, textValue(formData, "type"), CalendarEventType.SCHOOL_EVENT);
  const startDate = await userDateValue(textValue(formData, "startDate"));
  const rawEndDate = textValue(formData, "endDate");
  const endDate = rawEndDate ? await userDateValue(rawEndDate) : null;
  const subjectName = textValue(formData, "subjectName") || null;
  const note = textValue(formData, "note") || null;

  await prisma.calendarEvent.createMany({
    data: classroom.members.map((member) => ({
      studentId: member.studentId,
      title,
      type,
      startDate,
      endDate,
      subjectName,
      note,
      source: RecordSource.TEACHER,
    })),
  });

  redirect(`/class-admin?event=1&count=${classroom.members.length}`);
}
