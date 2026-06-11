"use server";

import { redirect } from "next/navigation";
import { CalendarEventType, RecordSource, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { formatDateInput, getRequestTimeZone, zonedDateStart } from "@/lib/timezone";
import { parseClassCalendarImport } from "@/lib/class-calendar-import";

const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;

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

async function managedClassroom(classroomId: string) {
  const session = await getCurrentSession();

  if (session?.role !== UserRole.CLASS_ADMIN) {
    redirect("/class-admin?error=class-admin-required");
  }

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

  return classroom;
}

function importErrorRedirect(issues: string[]): never {
  const params = new URLSearchParams({
    error: "import-validation",
    issues: JSON.stringify(issues),
  });
  redirect(`/class-admin?${params.toString()}`);
}

export async function createClassCalendarEvent(formData: FormData) {
  const classroomId = textValue(formData, "classroomId");
  const classroom = await managedClassroom(classroomId);

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

export async function importClassCalendarEvents(formData: FormData) {
  const classroomId = textValue(formData, "classroomId");
  const classroom = await managedClassroom(classroomId);
  const file = formData.get("file");

  if (!file || typeof file === "string" || file.size === 0) {
    importErrorRedirect(["請選擇要匯入的 CSV 或 XLSX 檔案。"]);
  }

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    importErrorRedirect(["檔案不可超過 2 MB。"]);
  }

  const result = await parseClassCalendarImport(file);
  if (result.issues.length > 0) {
    importErrorRedirect(result.issues);
  }

  const timeZone = await getRequestTimeZone();
  const data = result.rows.flatMap((row) =>
    classroom.members.map((member) => ({
      studentId: member.studentId,
      title: row.title,
      type: row.type,
      startDate: zonedDateStart(row.startDate, timeZone),
      endDate: row.endDate ? zonedDateStart(row.endDate, timeZone) : null,
      subjectName: row.subjectName,
      note: row.note,
      source: RecordSource.TEACHER,
    })),
  );

  await prisma.calendarEvent.createMany({ data });

  const params = new URLSearchParams({
    imported: "1",
    rows: String(result.rows.length),
    students: String(classroom.members.length),
    count: String(data.length),
  });
  redirect(`/class-admin?${params.toString()}`);
}
