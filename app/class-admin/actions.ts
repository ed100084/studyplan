"use server";

import { redirect } from "next/navigation";
import { CalendarEventType, RecordSource, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { formatDateInput, getDayRange, getRequestTimeZone, zonedDateStart } from "@/lib/timezone";
import {
  classCalendarImportRowKey,
  parseClassCalendarImport,
  validateClassCalendarImportRows,
} from "@/lib/class-calendar-import";
import type { ClassCalendarImportRow } from "@/lib/class-calendar-import";

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

export type ClassCalendarPreviewState = {
  issues: string[];
  fileName: string;
  rows: Array<ClassCalendarImportRow & { duplicate: boolean }>;
  totalRows: number;
  duplicateRows: number;
};

const emptyPreview = (issues: string[] = []): ClassCalendarPreviewState => ({
  issues,
  fileName: "",
  rows: [],
  totalRows: 0,
  duplicateRows: 0,
});

async function existingClassEventStudents(studentIds: string[], rows: ClassCalendarImportRow[], timeZone: string) {
  if (rows.length === 0) return new Map<string, Set<string>>();

  const dates = rows.map((row) => row.startDate).sort();
  const rangeEnd = getDayRange(dates.at(-1) ?? dates[0], timeZone).end;
  const events = await prisma.calendarEvent.findMany({
    where: {
      studentId: { in: studentIds },
      source: RecordSource.TEACHER,
      startDate: {
        gte: zonedDateStart(dates[0], timeZone),
        lt: rangeEnd,
      },
    },
  });

  const existingStudents = new Map<string, Set<string>>();
  events.forEach((event) => {
    const key = classCalendarImportRowKey({
      type: event.type,
      title: event.title,
      subjectName: event.subjectName,
      startDate: formatDateInput(event.startDate, timeZone),
      endDate: event.endDate ? formatDateInput(event.endDate, timeZone) : null,
      note: event.note,
    });
    const students = existingStudents.get(key) ?? new Set<string>();
    students.add(event.studentId);
    existingStudents.set(key, students);
  });

  return existingStudents;
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

export async function previewClassCalendarEvents(
  _previousState: ClassCalendarPreviewState,
  formData: FormData,
): Promise<ClassCalendarPreviewState> {
  const classroomId = textValue(formData, "classroomId");
  const classroom = await managedClassroom(classroomId);
  const file = formData.get("file");

  if (!file || typeof file === "string" || file.size === 0) {
    return emptyPreview(["請選擇要匯入的 CSV 或 XLSX 檔案。"]);
  }

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return emptyPreview(["檔案不可超過 2 MB。"]);
  }

  const result = await parseClassCalendarImport(file);
  if (result.issues.length > 0) {
    return emptyPreview(result.issues);
  }

  const timeZone = await getRequestTimeZone();
  const studentIds = classroom.members.map((member) => member.studentId);
  const existingStudents = await existingClassEventStudents(studentIds, result.rows, timeZone);
  const rows = result.rows.map((row) => ({
    ...row,
    duplicate: existingStudents.get(classCalendarImportRowKey(row))?.size === studentIds.length,
  }));

  return {
    issues: [],
    fileName: file.name,
    rows,
    totalRows: rows.length,
    duplicateRows: rows.filter((row) => row.duplicate).length,
  };
}

export async function confirmClassCalendarEvents(formData: FormData) {
  const classroomId = textValue(formData, "classroomId");
  const classroom = await managedClassroom(classroomId);
  const fileName = textValue(formData, "fileName").slice(0, 255) || "calendar-import";
  let serializedRows: unknown;

  try {
    serializedRows = JSON.parse(textValue(formData, "rows"));
  } catch {
    importErrorRedirect(["預覽資料已失效，請重新選擇檔案。"]);
  }

  const result = validateClassCalendarImportRows(serializedRows);
  if (result.issues.length > 0) importErrorRedirect(result.issues);

  const timeZone = await getRequestTimeZone();
  const studentIds = classroom.members.map((member) => member.studentId);
  const existingStudents = await existingClassEventStudents(studentIds, result.rows, timeZone);
  const rowsWithMissingStudents = result.rows.map((row) => ({
    row,
    missingStudentIds: studentIds.filter(
      (studentId) => !existingStudents.get(classCalendarImportRowKey(row))?.has(studentId),
    ),
  }));
  const importedRows = rowsWithMissingStudents.filter((item) => item.missingStudentIds.length > 0).length;
  const duplicateRows = result.rows.length - importedRows;
  const data = rowsWithMissingStudents.flatMap(({ row, missingStudentIds }) =>
    missingStudentIds.map((studentId) => ({
      studentId,
      title: row.title,
      type: row.type,
      startDate: zonedDateStart(row.startDate, timeZone),
      endDate: row.endDate ? zonedDateStart(row.endDate, timeZone) : null,
      subjectName: row.subjectName,
      note: row.note,
      source: RecordSource.TEACHER,
    })),
  );

  await prisma.$transaction(async (transaction) => {
    if (data.length > 0) await transaction.calendarEvent.createMany({ data });
    await transaction.classCalendarImport.create({
      data: {
        classroomId: classroom.id,
        managerId: classroom.managerId,
        fileName,
        totalRows: result.rows.length,
        importedRows,
        duplicateRows,
        studentCount: classroom.members.length,
      },
    });
  });

  const params = new URLSearchParams({
    imported: "1",
    rows: String(importedRows),
    duplicates: String(duplicateRows),
    students: String(classroom.members.length),
    count: String(data.length),
  });
  redirect(`/class-admin?${params.toString()}`);
}
