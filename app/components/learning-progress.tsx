import type { Score, StudyTask, Subject, WeakPoint } from "@prisma/client";
import { averageScore, buildWeeklyProgress } from "@/lib/learning-progress";
import { formatDateInput } from "@/lib/timezone";
import { createScore, createWeakPoint, deleteScore, deleteWeakPoint } from "@/app/learning/actions";

type ScoreWithSubject = Score & { subject: Subject };
type WeakPointWithSubject = WeakPoint & { subject: Subject };

type LearningProgressProps = {
  studentId?: string;
  scores: ScoreWithSubject[];
  weakPoints: WeakPointWithSubject[];
  weeklyTasks: Pick<StudyTask, "status" | "estimatedMinutes">[];
  today: string;
  timeZone: string;
};

const sourceLabels = {
  STUDENT: "學生",
  GUARDIAN: "家長",
  TEACHER: "老師",
  SYSTEM: "系統",
};

function groupScoresBySubject(scores: ScoreWithSubject[]) {
  const groups = new Map<string, ScoreWithSubject[]>();

  for (const score of scores) {
    const subjectScores = groups.get(score.subject.name) ?? [];
    subjectScores.push(score);
    groups.set(score.subject.name, subjectScores);
  }

  return Array.from(groups.entries()).map(([subjectName, subjectScores]) => ({
    subjectName,
    scores: subjectScores,
    latest: subjectScores[0],
    average: averageScore(subjectScores),
  }));
}

export function LearningProgress({ studentId, scores, weakPoints, weeklyTasks, today, timeZone }: LearningProgressProps) {
  const progress = buildWeeklyProgress(weeklyTasks);
  const recentAverage = averageScore(scores.slice(0, 5));
  const scoreGroups = groupScoresBySubject(scores);

  return (
    <section className="panel learning-panel">
      <div className="panel-header">
        <div>
          <h2>學習成果與弱點</h2>
          <p className="panel-copy">把成績和容易出錯的內容留下來，弱點可以直接排成補強任務。</p>
        </div>
        <span>本週摘要</span>
      </div>

      <div className="learning-metrics">
        <div>
          <strong>{progress.completionRate}%</strong>
          <span>任務完成率</span>
        </div>
        <div>
          <strong>{progress.completedTasks}</strong>
          <span>完成任務</span>
        </div>
        <div>
          <strong>{progress.creditedMinutes}</strong>
          <span>完成分鐘</span>
        </div>
        <div>
          <strong>{recentAverage ?? "-"}</strong>
          <span>近五次平均</span>
        </div>
      </div>

      <div className="learning-grid">
        <form className="form-card learning-form" id="new-score-form" action={createScore}>
          <h3>新增成績</h3>
          {studentId && <input name="studentId" type="hidden" value={studentId} />}
          <label>
            科目
            <input name="subjectName" placeholder="例如：數學" required />
          </label>
          <div className="field-row">
            <label>
              分數
              <input name="value" type="number" min="0" max="100" step="0.1" required />
            </label>
            <label>
              日期
              <input name="takenAt" type="date" defaultValue={today} required />
            </label>
          </div>
          <button className="button primary" type="submit">儲存成績</button>
        </form>

        <form className="form-card learning-form" id="new-weak-point-form" action={createWeakPoint}>
          <h3>記錄弱點</h3>
          {studentId && <input name="studentId" type="hidden" value={studentId} />}
          <label>
            科目
            <input name="subjectName" placeholder="例如：英文" required />
          </label>
          <label>
            弱點內容
            <input name="title" placeholder="例如：現在完成式容易混淆" required />
          </label>
          <div className="field-row">
            <label>
              錯題數
              <input name="wrongCount" type="number" min="1" defaultValue="1" />
            </label>
            <label>
              原因
              <input name="reason" placeholder="觀念不熟、粗心…" />
            </label>
          </div>
          <label className="checkbox-label">
            <input name="createTask" type="checkbox" defaultChecked /> 同時建立補強任務
          </label>
          <div className="field-row">
            <label>
              補強日期
              <input name="plannedDate" type="date" defaultValue={today} />
            </label>
            <label>
              預估分鐘
              <input name="estimatedMinutes" type="number" min="10" defaultValue="30" />
            </label>
          </div>
          <button className="button primary" type="submit">儲存弱點</button>
        </form>
      </div>

      <div className="learning-grid learning-history">
        <div>
          <h3>近期成績</h3>
          <div className="score-summary-list">
            {scoreGroups.map((group) => (
              <details className="score-summary-card" key={group.subjectName}>
                <summary>
                  <span>
                    <strong>{group.subjectName}</strong>
                    <small>{group.scores.length} 筆紀錄</small>
                  </span>
                  <span className="score-summary-metric">
                    最新 {group.latest.value} 分
                    {group.average !== null ? ` / 平均 ${group.average}` : ""}
                  </span>
                </summary>
                <div className="score-detail-list">
                  {group.scores.map((score) => (
                    <div className="score-detail-item" key={score.id}>
                      <div>
                        <strong>{score.value} 分</strong>
                        <span>{formatDateInput(score.takenAt, timeZone)}，由{sourceLabels[score.source]}登錄</span>
                      </div>
                      <form action={deleteScore}>
                        {studentId && <input name="studentId" type="hidden" value={studentId} />}
                        <input name="scoreId" type="hidden" value={score.id} />
                        <button className="small-button danger-button" type="submit">刪除</button>
                      </form>
                    </div>
                  ))}
                </div>
              </details>
            ))}
            {scores.length === 0 && (
              <div className="empty-state">
                <p>還沒有成績紀錄。</p>
                <div className="empty-state-actions">
                  <a className="small-button" href="#new-score-form">＋ 新增第一筆成績</a>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3>待補強弱點</h3>
          <div className="learning-list">
            {weakPoints.map((weakPoint) => (
              <div className="learning-item" key={weakPoint.id}>
                <div>
                  <strong>{weakPoint.subject.name}：{weakPoint.title}</strong>
                  <span>錯題 {weakPoint.wrongCount} 題{weakPoint.reason ? `，${weakPoint.reason}` : ""}</span>
                </div>
                <form action={deleteWeakPoint}>
                  {studentId && <input name="studentId" type="hidden" value={studentId} />}
                  <input name="weakPointId" type="hidden" value={weakPoint.id} />
                  <button className="small-button" type="submit">已改善</button>
                </form>
              </div>
            ))}
            {weakPoints.length === 0 && (
              <div className="empty-state">
                <p>目前沒有待補強弱點。</p>
                <div className="empty-state-actions">
                  <a className="small-button" href="#new-weak-point-form">＋ 新增第一筆弱點</a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
