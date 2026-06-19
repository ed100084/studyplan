import type { TaskType } from "@prisma/client";
import { parse } from "csv-parse/sync";

const MAX_IMPORT_ROWS = 500;
const EXPECTED_HEADERS = ["date", "subject", "title", "type", "minutes", "priority", "note"];
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
  const labelType = taskTypeAliases[value];
  if (labelType) {
    return labelType;
  }

  const enumValue = value.toUpperCase().replace(/[\s-]+/g, "_");
  return TASK_TYPES.includes(enumValue as TaskType) ? (enumValue as TaskType) : "REVIEW";
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
  if (header.length !== EXPECTED_HEADERS.length || EXPECTED_HEADERS.some((name, index) => header[index] !== name)) {
    return { rows: [], errors: [`第 1 列：表頭必須固定為 ${EXPECTED_HEADERS.join(",")}`] };
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
    const date = parseDate(textValue(row[0]));
    const subjectName = textValue(row[1]) || null;
    const title = textValue(row[2]);
    const type = parseTaskType(textValue(row[3]));
    const minutes = parseInteger(textValue(row[4]), 30);
    const estimatedMinutes = Math.max(10, minutes.value);
    const parsedPriority = parseInteger(textValue(row[5]), 3);
    const priority = parsedPriority.value;
    const description = textValue(row[6]) || null;
    const rowErrors: string[] = [];

    if (row.slice(EXPECTED_HEADERS.length).some((value) => textValue(value))) rowErrors.push("欄位數量不符合固定格式");
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

  if (sourceRows.length === 0) {
    errors.push("CSV 沒有可匯入資料。");
  }

  return { rows, errors };
}
