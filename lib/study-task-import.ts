import type { TaskType } from "@prisma/client";
import { parse } from "csv-parse/sync";

const MAX_IMPORT_ROWS = 500;
const TASK_HEADERS = ["date", "subject", "title", "type", "minutes", "priority", "note"] as const;
const TASK_HEADERS_WITH_TIME = ["date", "startTime", "endTime", "subject", "title", "type", "minutes", "priority", "note"] as const;
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
] as const;
const SUPPORTED_HEADER_DESCRIPTION = `${TASK_HEADERS.join(",")}、${TASK_HEADERS_WITH_TIME.join(",")}，或月曆匯出的 ${EXPORT_HEADERS.join(",")}`;
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
  plannedStartTime: string | null;
  plannedEndTime: string | null;
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

function parseTime(value: string) {
  if (!value) {
    return null;
  }

  if (!/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return value;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
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

function normalizeHeaderName(value: string) {
  return value.toLowerCase().replace(/[\s_\-（）()]/g, "");
}

function hasHeader(header: string[], names: string[]) {
  const aliases = names.map(normalizeHeaderName);
  return header.some((value) => aliases.includes(normalizeHeaderName(value)));
}

function indexOfHeader(header: string[], names: string[]) {
  const aliases = names.map(normalizeHeaderName);
  return header.findIndex((value) => aliases.includes(normalizeHeaderName(value)));
}

function readColumn(row: string[], index: number) {
  return index >= 0 ? textValue(row[index]) : "";
}

function buildColumnMap(header: string[]) {
  const exportLike = hasHeader(header, ["category", "分類", "項目類型", "事件類型"]) || hasHeader(header, ["status", "狀態"]);
  const typeAliases = exportLike ? ["category", "分類", "項目類型", "事件類型"] : ["type", "taskType", "任務類型", "類型"];

  return {
    exportLike,
    date: indexOfHeader(header, ["date", "plannedDate", "planned_date", "日期", "任務日期"]),
    subject: indexOfHeader(header, ["subject", "subjectName", "科目"]),
    title: indexOfHeader(header, ["title", "task", "taskTitle", "任務", "任務名稱", "標題", "名稱"]),
    type: indexOfHeader(header, typeAliases),
    startTime: indexOfHeader(header, ["startTime", "start_time", "開始時間", "開始"]),
    endTime: indexOfHeader(header, ["endTime", "end_time", "結束時間", "結束"]),
    minutes: indexOfHeader(header, ["minutes", "estimatedMinutes", "estimated_minutes", "預估分鐘", "分鐘", "時間"]),
    priority: indexOfHeader(header, ["priority", "優先度", "優先"]),
    note: indexOfHeader(header, ["note", "detail", "description", "備註", "說明", "細節"]),
  };
}

function missingRequiredColumns(columns: ReturnType<typeof buildColumnMap>) {
  const missing: string[] = [];
  if (columns.date < 0) missing.push("date");
  if (columns.title < 0) missing.push("title");
  if (columns.type < 0) missing.push(columns.exportLike ? "category" : "type");
  return missing;
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
  const columns = buildColumnMap(header);
  const missingColumns = missingRequiredColumns(columns);

  if (missingColumns.length > 0) {
    return {
      rows: [],
      errors: [
        `第 1 列：表頭缺少必要欄位 ${missingColumns.join("、")}。支援欄位為 ${SUPPORTED_HEADER_DESCRIPTION}；也可使用中文欄名如 日期、科目、標題、類型、分鐘、優先度、備註。`,
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
    const values = {
      date: readColumn(row, columns.date),
      subject: readColumn(row, columns.subject),
      title: readColumn(row, columns.title),
      type: readColumn(row, columns.type),
      startTime: readColumn(row, columns.startTime),
      endTime: readColumn(row, columns.endTime),
      minutes: readColumn(row, columns.minutes),
      priority: readColumn(row, columns.priority),
      note: readColumn(row, columns.note),
    };
    const strictType = columns.exportLike ? parseTaskTypeStrict(values.type) : parseTaskType(values.type);
    if (columns.exportLike && !strictType) {
      return;
    }

    const date = parseDate(values.date);
    const plannedStartTime = parseTime(values.startTime);
    const plannedEndTime = parseTime(values.endTime);
    const hasStartTime = Boolean(values.startTime);
    const hasEndTime = Boolean(values.endTime);
    const fixedTimeMinutes = plannedStartTime && plannedEndTime ? timeToMinutes(plannedEndTime) - timeToMinutes(plannedStartTime) : null;
    const subjectName = values.subject || null;
    const title = values.title;
    const type = strictType ?? "REVIEW";
    const minutes = parseInteger(values.minutes, fixedTimeMinutes && fixedTimeMinutes > 0 ? fixedTimeMinutes : 30);
    const estimatedMinutes = Math.max(10, minutes.value);
    const parsedPriority = parseInteger(values.priority, 3);
    const priority = parsedPriority.value;
    const description = values.note || null;
    const rowErrors: string[] = [];

    if (!date) rowErrors.push("date 必須是 YYYY-MM-DD");
    if (hasStartTime && !plannedStartTime) rowErrors.push("startTime 必須是 HH:mm");
    if (hasEndTime && !plannedEndTime) rowErrors.push("endTime 必須是 HH:mm");
    if (hasStartTime !== hasEndTime) rowErrors.push("startTime 和 endTime 必須一起填寫");
    if (fixedTimeMinutes !== null && fixedTimeMinutes < 10) rowErrors.push("startTime 到 endTime 至少要 10 分鐘，且結束時間必須晚於開始時間");
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
      plannedStartTime,
      plannedEndTime,
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
