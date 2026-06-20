import assert from "node:assert/strict";
import test from "node:test";
import { TaskType } from "@prisma/client";
import { parseStudyTaskCsv } from "../lib/study-task-import";

test("parses study task CSV with quoted commas and Chinese task type labels", () => {
  const result = parseStudyTaskCsv(`date,subject,title,type,minutes,priority,note
2026-07-01,數學,"複習一元一次方程, 應用題",複習,45,4,"注意單位換算, 圖表題"
2026-07-02,英文,背單字,PRACTICE,,,
`);

  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].type, TaskType.REVIEW);
  assert.equal(result.rows[0].title, "複習一元一次方程, 應用題");
  assert.equal(result.rows[0].description, "注意單位換算, 圖表題");
  assert.equal(result.rows[0].estimatedMinutes, 45);
  assert.equal(result.rows[0].priority, 4);
  assert.equal(result.rows[1].type, TaskType.PRACTICE);
  assert.equal(result.rows[1].estimatedMinutes, 30);
  assert.equal(result.rows[1].priority, 3);
});

test("collects study task CSV row errors without returning partial rows", () => {
  const result = parseStudyTaskCsv(`date,subject,title,type,minutes,priority,note
2026-02-30,數學,無效日期,複習,30,3,
2026-07-02,英文,,練習,30,6,
`);

  assert.equal(result.rows.length, 0);
  assert.equal(result.errors.length, 2);
  assert.match(result.errors[0], /第 2 列/);
  assert.match(result.errors[0], /date/);
  assert.match(result.errors[1], /第 3 列/);
  assert.match(result.errors[1], /title/);
  assert.match(result.errors[1], /priority/);
});

test("requires the fixed study task CSV header", () => {
  const result = parseStudyTaskCsv("date,title\n2026-07-01,讀書");

  assert.equal(result.rows.length, 0);
  assert.match(result.errors[0], /表頭缺少必要欄位/);
});

test("imports only task rows from exported calendar CSV", () => {
  const result = parseStudyTaskCsv(`date,weekday,startTime,endTime,category,title,subject,detail,status,minutes,priority
2026-07-01,週三,09:00,12:00,可讀書時段,暑假上午,,,180,
2026-07-01,週三,18:30,20:30,補習,數學補習,數學,疲勞 普通,,,
2026-07-01,週三,20:40,21:25,複習,一元一次方程,數學,注意錯題,待完成,45,4
`);

  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].title, "一元一次方程");
  assert.equal(result.rows[0].type, TaskType.REVIEW);
  assert.equal(result.rows[0].estimatedMinutes, 45);
  assert.equal(result.rows[0].priority, 4);
});

test("accepts reordered task CSV columns and Chinese headers", () => {
  const result = parseStudyTaskCsv(`標題,日期,優先度,備註,分鐘,科目,類型
背英文單字,2026-07-03,2,Unit 1,25,英文,練習
`);

  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].date, "2026-07-03");
  assert.equal(result.rows[0].subjectName, "英文");
  assert.equal(result.rows[0].title, "背英文單字");
  assert.equal(result.rows[0].type, TaskType.PRACTICE);
  assert.equal(result.rows[0].estimatedMinutes, 25);
  assert.equal(result.rows[0].priority, 2);
});
