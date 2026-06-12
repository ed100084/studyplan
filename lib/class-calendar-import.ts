import { CalendarEventType } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { readSheet } from "read-excel-file/node";

const MAX_IMPORT_ROWS = 500;

type ImportField = "type" | "title" | "subjectName" | "startDate" | "endDate" | "note";
type CellValue = string | number | boolean | Date | null;

export type ClassCalendarImportRow = {
  type: CalendarEventType;
  title: string;
  subjectName: string | null;
  startDate: string;
  endDate: string | null;
  note: string | null;
};

export type ClassCalendarImportResult =
  | { rows: ClassCalendarImportRow[]; issues: [] }
  | { rows: []; issues: string[] };

export function classCalendarImportRowKey(row: ClassCalendarImportRow) {
  return [row.type, row.title, row.subjectName ?? "", row.startDate, row.endDate ?? "", row.note ?? ""].join("|");
}

export function validateClassCalendarImportRows(value: unknown): ClassCalendarImportResult {
  if (!Array.isArray(value) || value.length === 0) {
    return { rows: [], issues: ["沒有可匯入的資料列。"] };
  }

  if (value.length > MAX_IMPORT_ROWS) {
    return { rows: [], issues: [`一次最多匯入 ${MAX_IMPORT_ROWS} 列，目前有 ${value.length} 列。`] };
  }

  const rows: ClassCalendarImportRow[] = [];
  const issues: string[] = [];
  const duplicateKeys = new Set<string>();

  value.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      issues.push(`第 ${index + 1} 列：資料格式無效`);
      return;
    }

    const candidate = item as Record<string, unknown>;
    const type = typeof candidate.type === "string" ? normalizedType(candidate.type) : null;
    const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
    const subjectName = typeof candidate.subjectName === "string" ? candidate.subjectName.trim() || null : null;
    const startDate = typeof candidate.startDate === "string" ? normalizedDate(candidate.startDate) : null;
    const endDate = typeof candidate.endDate === "string" && candidate.endDate ? normalizedDate(candidate.endDate) : null;
    const note = typeof candidate.note === "string" ? candidate.note.trim() || null : null;
    const rowIssues: string[] = [];

    if (!type) rowIssues.push("類型無效");
    if (!title) rowIssues.push("標題必填");
    if (title.length > 120) rowIssues.push("標題不可超過 120 字");
    if (subjectName && subjectName.length > 80) rowIssues.push("科目不可超過 80 字");
    if (!startDate) rowIssues.push("開始日期格式無效");
    if (candidate.endDate && !endDate) rowIssues.push("結束日期格式無效");
    if (startDate && endDate && endDate < startDate) rowIssues.push("結束日期不可早於開始日期");
    if (note && note.length > 500) rowIssues.push("備註不可超過 500 字");

    if (type && startDate) {
      const row = { type, title, subjectName, startDate, endDate, note };
      const key = classCalendarImportRowKey(row);
      if (duplicateKeys.has(key)) rowIssues.push("與其他資料重複");
      duplicateKeys.add(key);
      if (rowIssues.length === 0) rows.push(row);
    }

    if (rowIssues.length > 0) issues.push(`第 ${index + 1} 列：${rowIssues.join("、")}`);
  });

  return issues.length > 0 ? { rows: [], issues: issues.slice(0, 8) } : { rows, issues: [] };
}

const headerAliases: Record<string, ImportField> = {
  type: "type",
  eventtype: "type",
  類型: "type",
  title: "title",
  標題: "title",
  subject: "subjectName",
  subjectname: "subjectName",
  科目: "subjectName",
  startdate: "startDate",
  開始日期: "startDate",
  enddate: "endDate",
  結束日期: "endDate",
  note: "note",
  notes: "note",
  備註: "note",
};

const typeAliases: Record<string, CalendarEventType> = {
  段考: CalendarEventType.SECTION_EXAM,
  模擬考: CalendarEventType.MOCK_EXAM,
  升學考試: CalendarEventType.ENTRANCE_EXAM,
  學校活動: CalendarEventType.SCHOOL_EVENT,
  截止日: CalendarEventType.DEADLINE,
  其他: CalendarEventType.OTHER,
};

function normalizedKey(value: CellValue) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function textValue(value: CellValue) {
  if (value instanceof Date) {
    return formatDate(value);
  }

  return String(value ?? "").trim();
}

function formatDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizedDate(value: CellValue) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate(value);
  }

  const raw = textValue(value);
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(raw);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizedType(value: CellValue) {
  const raw = textValue(value);
  if (typeAliases[raw]) {
    return typeAliases[raw];
  }

  const enumKey = raw.toUpperCase().replace(/[\s-]+/g, "_");
  return Object.values(CalendarEventType).includes(enumKey as CalendarEventType)
    ? (enumKey as CalendarEventType)
    : null;
}

function rowIsEmpty(row: CellValue[]) {
  return row.every((value) => textValue(value) === "");
}

async function spreadsheetRows(file: File): Promise<CellValue[][]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    return parse(buffer, {
      bom: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    }) as CellValue[][];
  }

  if (extension === "xlsx") {
    return (await readSheet(buffer)) as CellValue[][];
  }

  throw new Error("unsupported-file-type");
}

export async function parseClassCalendarImport(file: File): Promise<ClassCalendarImportResult> {
  let data: CellValue[][];

  try {
    data = await spreadsheetRows(file);
  } catch {
    return { rows: [], issues: ["無法讀取檔案，請確認格式是 UTF-8 CSV 或有效的 XLSX。"] };
  }

  if (data.length < 2) {
    return { rows: [], issues: ["檔案至少需要一列表頭與一列資料。"] };
  }

  const headerIndexes = new Map<ImportField, number>();
  data[0].forEach((value, index) => {
    const field = headerAliases[normalizedKey(value)];
    if (field && !headerIndexes.has(field)) {
      headerIndexes.set(field, index);
    }
  });

  const missingHeaders = (["type", "title", "startDate"] as ImportField[]).filter(
    (field) => !headerIndexes.has(field),
  );
  if (missingHeaders.length > 0) {
    return { rows: [], issues: ["缺少必要欄位：類型、標題、開始日期。請下載範本後再匯入。"] };
  }

  const sourceRows = data
    .slice(1)
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => !rowIsEmpty(row));
  if (sourceRows.length > MAX_IMPORT_ROWS) {
    return { rows: [], issues: [`一次最多匯入 ${MAX_IMPORT_ROWS} 列，目前有 ${sourceRows.length} 列。`] };
  }

  const rows: ClassCalendarImportRow[] = [];
  const issues: string[] = [];
  const duplicateKeys = new Set<string>();
  const cell = (row: CellValue[], field: ImportField) => row[headerIndexes.get(field) ?? -1] ?? null;

  sourceRows.forEach(({ row, rowNumber }) => {
    const type = normalizedType(cell(row, "type"));
    const title = textValue(cell(row, "title"));
    const subjectName = textValue(cell(row, "subjectName")) || null;
    const startDate = normalizedDate(cell(row, "startDate"));
    const rawEndDate = textValue(cell(row, "endDate"));
    const endDate = rawEndDate ? normalizedDate(cell(row, "endDate")) : null;
    const note = textValue(cell(row, "note")) || null;
    const rowIssues: string[] = [];

    if (!type) rowIssues.push("類型無效");
    if (!title) rowIssues.push("標題必填");
    if (title.length > 120) rowIssues.push("標題不可超過 120 字");
    if (subjectName && subjectName.length > 80) rowIssues.push("科目不可超過 80 字");
    if (!startDate) rowIssues.push("開始日期格式無效");
    if (rawEndDate && !endDate) rowIssues.push("結束日期格式無效");
    if (startDate && endDate && endDate < startDate) rowIssues.push("結束日期不可早於開始日期");
    if (note && note.length > 500) rowIssues.push("備註不可超過 500 字");

    const duplicateKey = type && startDate
      ? classCalendarImportRowKey({ type, title, subjectName, startDate, endDate, note })
      : "";
    if (duplicateKeys.has(duplicateKey)) rowIssues.push("與檔案內其他資料重複");

    if (rowIssues.length > 0 || !type || !startDate) {
      issues.push(`第 ${rowNumber} 列：${rowIssues.join("、")}`);
      return;
    }

    duplicateKeys.add(duplicateKey);
    rows.push({ type, title, subjectName, startDate, endDate, note });
  });

  if (issues.length > 0) {
    return { rows: [], issues: issues.slice(0, 8) };
  }

  if (rows.length === 0) {
    return { rows: [], issues: ["檔案沒有可匯入的資料列。"] };
  }

  return { rows, issues: [] };
}
