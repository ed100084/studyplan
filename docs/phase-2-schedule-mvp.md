# Phase 2 Schedule MVP

## Version

`1.4.1`

## Update 1.4.1

- Added browser time zone detection with a persistent cookie.
- Calendar and daily schedule pages now calculate today, week, month, and task date boundaries from the user's time zone.
- Task creation, editing, and carryover actions now preserve the user's local date semantics.
- Student and guardian pages display the active time zone next to today's date.

## Update 1.4.0

- Added a current-month calendar summary to the student page.
- Added the same monthly calendar summary to the guardian page for the selected linked student.
- Monthly calendar cards show recurring tutoring count, fixed routine count, task count, key task labels, and estimated study minutes.
- Schedule queries now cover the union of the current week and current month so week cards remain complete when a week crosses month boundaries.

## Update 1.3.0

- Added a current-week calendar summary to the student page.
- Added the same weekly calendar summary to the guardian page for the selected linked student.
- Weekly calendar cards show fixed routine count, tutoring count, task count, completion status counts, estimated minutes, and key item labels per weekday.
- Daily timeline, daily task list, and generated schedule remain scoped to today while the weekly calendar reads the full current week.

## Update 1.2.0

- Added split-task scheduling for large tasks that do not fit one continuous slot.
- Split segments keep the same task id and show their part number in schedule details.
- Large tasks are only placed when all segments can fit today, so impossible tasks do not consume smaller slots that shorter tasks could use.
- Updated unplaced explanations for fragmented remaining time.

## Update 1.1.0

- Added partial-complete tracking for planned tasks using existing task logs.
- Added bulk carryover for unplaced tasks so they can move to tomorrow.
- Added clearer unplaced-task explanations based on remaining time and largest available slot.
- Carryover actions preserve student/guardian ownership checks.

## Update 1.0.0

- Added collapsed edit forms for fixed routine events, tutoring sessions, and study tasks.
- Added server-side update actions with the same student/guardian ownership checks as create/delete flows.
- Guardian edits preserve the active linked student.
- Edited routine, tutoring, and task records revalidate student and guardian pages so the generated daily schedule updates immediately.

## Update 0.9.0

- Added delete actions for fixed events, tutoring sessions, and study tasks.
- Added task correction flows for done, skipped, and rescheduled states.
- Rescheduled tasks move to the next day and keep an audit log.
- Guardian correction actions preserve the selected linked student.

## Update 0.8.0

- Added a pure today scheduler under `lib/scheduler/today.ts`.
- The scheduler blocks fixed routine events, tutoring sessions, and tutoring commute time.
- Planned tasks are placed by priority and estimated minutes.
- A 10-minute break is kept between scheduled study tasks.
- High-fatigue tutoring reduces later available study capacity.
- Student and guardian pages now show a generated schedule and unplaced tasks.

## Update 0.7.1

- Replaced guardian-student linking by student email with a student link code.
- Student page displays a link code that guardians can use.
- Guardian page supports multiple linked students.
- Guardian page can switch the active student through URL-backed child tabs.
- Guardian schedule actions preserve the selected student after submit.
- Added `StudentProfile.linkCode` and a migration that backfills existing students.

## Completed

- Student page can create fixed routine events, tutoring sessions, and study tasks.
- Student page shows today's fixed events, tutoring sessions, open tasks, and completed tasks.
- Guardian page can manage the first linked student's routine, tutoring, and tasks.
- Guardians can mark linked student tasks as done.
- Schedule mutations are implemented as Next.js Server Actions.

## Current Scope

This version is a data-entry, daily timeline, correction, edit, progress-tracking, split-scheduling, weekly-calendar, monthly-calendar, and user-time-zone-aware MVP. It can auto-place today's planned tasks into available after-school slots, show current week and month workload in the user's time zone, and let students or guardians correct, edit, partially complete, or carry over tasks.

## Next

- Persist generated schedule runs for later review.
- Add persisted weekly planning with schedule history.
- Add school events and exam dates for longer-range planning.
