import type { TaskType } from "@prisma/client";
import { parse } from "csv-parse/sync";

const MAX_IMPORT_ROWS = 500;
const TASK_HEADERS = ["date", "subject", "title", "type", "minutes", "priority", "note"];
const TASK_HEADERS_WITH_TIME = ["date", "startTime", "endTime", "subject", "title", "type", "minutes", "priority", "note"];
const EXPORT_HEADERS = [
  "date",
  "weekday",
  "startTime",
  "endTime",
  "category",
  "title",
  "subject",
  "detail",
  "status",
  "minutes",
  "priority",
];
const TASK_TYPES = [
  "SCHOOL_HOMEWORK",
  "TUTORING_HOMEWORK",
  "REVIEW",
  "PRACTICE",
  "WEAK_POINT",
  "PREVIEW",
  "EXAM_SPRINT",
] as const satisfies readonly TaskType[];

export type StudyTaskImportRow = {
  date: string;
  subjectName: string | null;
  title: string;
  type: TaskType;
  estimatedMinutes: number;
  priority: number;
  description: string | null;
};

export type StudyTaskImportResult = {
  rows: StudyTaskImportRow[];
  errors: string[];
};

const taskTypeAliases: Record<string, TaskType> = {
  學校作業: "SCHOOL_HOMEWORK",
  學校功課: "SCHOOL_HOMEWORK",
  補習作業: "TUTORING_HOMEWORK",
  補習功課: "TUTORING_HOMEWORK",
  複習: "REVIEW",
  復習: "REVIEW",
  練習: "PRACTICE",
  弱點: "WEAK_POINT",
  弱點補強: "WEAK_POINT",
  預習: "PREVIEW",
  考前衝刺: "EXAM_SPRINT",
};

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return null;
  }

  return value;
}

function parseTaskType(value: string) {
  return parseTaskTypeStrict(value) ?? "REVIEW";
}

function parseTaskTypeStrict(value: string) {
  const labelType = taskTypeAliases[value];
  if (labelType) {
    return labelType;
  }

  const enumValue = value.toUpperCase().replace(/[\s-]+/g, "_");
  return TASK_TYPES.includes(enumValue as TaskType) ? (enumValue as TaskType) : null;
}

function parseInteger(value: string, fallback: number) {
  if (!value) {
    return { value: fallback, valid: true };
  }

  if (!/^\d+$/.test(value)) {
    return { value: fallback, valid: false };
  }

  const parsed = Number.parseInt(value, 10);
  return { value: parsed, valid: Number.isFinite(parsed) };
}

function rowIsEmpty(row: unknown[]) {
  return row.every((value) => textValue(value) === "");
}

function headerMatches(header: string[], expected: string[]) {
  return header.length === expected.length && expected.every((name, index) => header[index] === name);
}

export function parseStudyTaskCsv(text: string): StudyTaskImportResult {
  let data: string[][];

  try {
    data = parse(text, {
      bom: true,
      relax_column_count: true,
      skip_empty_lines: false,
      trim: true,
    }) as string[][];
  } catch {
    return { rows: [], errors: ["CSV 格式無法解析，請確認雙引號與逗號格式。"] };
  }

  if (data.length === 0 || data.every(rowIsEmpty)) {
    return { rows: [], errors: ["CSV 沒有可匯入資料。"] };
  }

  const header = data[0].map((value) => textValue(value));
  const format = headerMatches(header, TASK_HEADERS)
    ? "task"
    : headerMatches(header, TASK_HEADERS_WITH_TIME)
      ? "taskWithTime"
      : headerMatches(header, EXPORT_HEADERS)
        ? "export"
        : null;

  if (!format) {
    return {
      rows: [],
      errors: [
        `第 1 列：表頭必須固定為 ${TASK_HEADERS.join(",")}、${TASK_HEADERS_WITH_TIME.join(",")}，或月曆匯出的 ${EXPORT_HEADERS.join(",")}`,
      ],
    };
  }

  const sourceRows = data
    .slice(1)
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => !rowIsEmpty(row));

  if (sourceRows.length > MAX_IMPORT_ROWS) {
    return { rows: [], errors: [`一次最多匯入 ${MAX_IMPORT_ROWS} 筆，目前有 ${sourceRows.length} 筆。`] };
  }

  const rows: StudyTaskImportRow[] = [];
  const errors: string[] = [];

  sourceRows.forEach(({ row, rowNumber }) => {
    const values =
      format === "export"
        ? {
            date: textValue(row[0]),
            subject: textValue(row[6]),
            title: textValue(row[5]),
            type: textValue(row[4]),
            minutes: textValue(row[9]),
            priority: textValue(row[10]),
            note: textValue(row[7]),
            extraValues: row.slice(EXPORT_HEADERS.length),
          }
        : format === "taskWithTime"
          ? {
              date: textValue(row[0]),
              subject: textValue(row[3]),
              title: textValue(row[4]),
              type: textValue(row[5]),
              minutes: textValue(row[6]),
              priority: textValue(row[7]),
              note: textValue(row[8]),
              extraValues: row.slice(TASK_HEADERS_WITH_TIME.length),
            }
          : {
              date: textValue(row[0]),
              subject: textValue(row[1]),
              title: textValue(row[2]),
              type: textValue(row[3]),
              minutes: textValue(row[4]),
              priority: textValue(row[5]),
              note: textValue(row[6]),
              extraValues: row.slice(TASK_HEADERS.length),
            };
    const strictType = format === "export" ? parseTaskTypeStrict(values.type) : parseTaskType(values.type);
    if (format === "export" && !strictType) {
      return;
    }

    const date = parseDate(values.date);
    const subjectName = values.subject || null;
    const title = values.title;
    const type = strictType ?? "REVIEW";
    const minutes = parseInteger(values.minutes, 30);
    const estimatedMinutes = Math.max(10, minutes.value);
    const parsedPriority = parseInteger(values.priority, 3);
    const priority = parsedPriority.value;
    const description = values.note || null;
    const rowErrors: string[] = [];

    if (values.extraValues.some((value) => textValue(value))) rowErrors.push("欄位數量不符合固定格式");
    if (!date) rowErrors.push("date 必須是 YYYY-MM-DD");
    if (!title) rowErrors.push("title 必填");
    if (title.length > 120) rowErrors.push("title 最多 120 字");
    if (subjectName && subjectName.length > 80) rowErrors.push("subject 最多 80 字");
    if (!minutes.valid) rowErrors.push("minutes 必須是整數");
    if (!parsedPriority.valid || priority < 1 || priority > 5) rowErrors.push("priority 必須介於 1 到 5");
    if (description && description.length > 500) rowErrors.push("note 最多 500 字");

    if (rowErrors.length > 0 || !date) {
      errors.push(`第 ${rowNumber} 列：${rowErrors.join("、")}`);
      return;
    }

    rows.push({
      date,
      subjectName,
      title,
      type,
      estimatedMinutes,
      priority,
      description,
    });
  });

  if (sourceRows.length === 0 || (rows.length === 0 && errors.length === 0)) {
    errors.push("CSV 沒有可匯入資料。");
  }

  return { rows, errors };
}
