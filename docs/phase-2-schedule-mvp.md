# Phase 2 Schedule MVP

## Version

`1.1.0`

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

This version is a data-entry, daily timeline, correction, edit, and progress-tracking MVP. It can auto-place today's planned tasks into available after-school slots and lets students or guardians correct, edit, partially complete, or carry over tasks.

## Next

- Persist generated schedule runs for later review.
- Add cross-day rollover and weekly planning.
- Add split-task scheduling for large tasks that do not fit one continuous slot.
