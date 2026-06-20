"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CalendarEvent,
  CalendarEventType,
  FatigueLevel,
  FixedEvent,
  FixedEventType,
  StudyTask,
  StudyWindow,
  Subject,
  TaskStatus,
  TaskType,
  TutoringSession,
} from "@prisma/client";
import type { ScheduleSegment } from "@/lib/scheduler/today";
import { DayDetailPanel } from "@/app/components/day-detail-panel";

type StudyTaskWithSubject = StudyTask & {
  subject: Subject | null;
};

type DaySchedule = {
  scheduled: ScheduleSegment[];
  unplaced: ScheduleSegment[];
  availableMinutes: number;
  scheduledStudyMinutes: number;
};

export type CalendarDayDetailData = {
  date: string;
  weekdayLabel: string;
  isToday: boolean;
  fixedEvents: FixedEvent[];
  studyWindows: StudyWindow[];
  tutoringSessions: TutoringSession[];
  calendarEvents: CalendarEvent[];
  tasks: StudyTaskWithSubject[];
  schedule: DaySchedule | null;
};

type CalendarDayDetailBrowserProps = {
  initialDate: string;
  days: CalendarDayDetailData[];
  timeZone: string;
  fixedEventLabels: Record<FixedEventType, string>;
  taskTypeLabels: Record<TaskType, string>;
  calendarEventLabels: Record<CalendarEventType, string>;
  fatigueLabels: Record<FatigueLevel, string>;
  statusLabels: Record<TaskStatus, string>;
  newStudyTaskHref: string;
  newFixedEventHref: string;
  newTutoringHref: string;
  newCalendarEventHref: string;
  children: React.ReactNode;
};

export function CalendarDayDetailBrowser({
  initialDate,
  days,
  timeZone,
  fixedEventLabels,
  taskTypeLabels,
  calendarEventLabels,
  fatigueLabels,
  statusLabels,
  newStudyTaskHref,
  newFixedEventHref,
  newTutoringHref,
  newCalendarEventHref,
  children,
}: CalendarDayDetailBrowserProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const detailsByDate = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
  const selectedDay = detailsByDate.get(selectedDate) ?? detailsByDate.get(initialDate) ?? days[0];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.querySelectorAll<HTMLAnchorElement>("a[data-calendar-date]").forEach((link) => {
      link.classList.toggle("selected", link.dataset.calendarDate === selectedDate);
    });
  }, [selectedDate]);

  useEffect(() => {
    function handlePopState() {
      const date = new URLSearchParams(window.location.search).get("date");
      if (date && detailsByDate.has(date)) {
        setSelectedDate(date);
        setIsDetailOpen(true);
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [detailsByDate]);

  useEffect(() => {
    if (!isDetailOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDetailOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDetailOpen]);

  function handleCalendarClick(event: React.MouseEvent<HTMLDivElement>) {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-calendar-date]");
    if (!link) return;

    const date = link.dataset.calendarDate;
    if (!date || !detailsByDate.has(date)) return;

    event.preventDefault();
    setSelectedDate(date);
    setIsDetailOpen(true);
    window.history.pushState(null, "", link.href);
  }

  if (!selectedDay) {
    return <div ref={containerRef} onClick={handleCalendarClick}>{children}</div>;
  }

  return (
    <div className="calendar-detail-browser" ref={containerRef} onClick={handleCalendarClick}>
      {children}
      {isDetailOpen && selectedDay && (
        <div
          className="calendar-detail-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedDay.date} 圖表式時間軸`}
          onClick={() => setIsDetailOpen(false)}
        >
          <div className="calendar-detail-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="calendar-detail-dialog-actions">
              <button className="small-button" type="button" onClick={() => setIsDetailOpen(false)}>
                關閉
              </button>
            </div>
            <DayDetailPanel
              date={selectedDay.date}
              timeZone={timeZone}
              weekdayLabel={selectedDay.weekdayLabel}
              isToday={selectedDay.isToday}
              fixedEvents={selectedDay.fixedEvents}
              studyWindows={selectedDay.studyWindows}
              tutoringSessions={selectedDay.tutoringSessions}
              calendarEvents={selectedDay.calendarEvents}
              tasks={selectedDay.tasks}
              schedule={selectedDay.schedule}
              fixedEventLabels={fixedEventLabels}
              taskTypeLabels={taskTypeLabels}
              calendarEventLabels={calendarEventLabels}
              fatigueLabels={fatigueLabels}
              statusLabels={statusLabels}
              newStudyTaskHref={newStudyTaskHref}
              newFixedEventHref={newFixedEventHref}
              newTutoringHref={newTutoringHref}
              newCalendarEventHref={newCalendarEventHref}
            />
          </div>
        </div>
      )}
    </div>
  );
}
