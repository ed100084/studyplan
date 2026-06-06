# Phase 2 Schedule MVP

## Version

`0.7.0`

## Completed

- Student page can create fixed routine events, tutoring sessions, and study tasks.
- Student page shows today's fixed events, tutoring sessions, open tasks, and completed tasks.
- Guardian page can manage the first linked student's routine, tutoring, and tasks.
- Guardians can mark linked student tasks as done.
- Schedule mutations are implemented as Next.js Server Actions.

## Current Scope

This version is a data-entry and daily timeline MVP. It does not yet auto-place tasks into available study slots.

## Next

- Add a deterministic scheduler that blocks fixed events and tutoring sessions.
- Split available after-school time into study blocks and rest blocks.
- Auto-place tasks by deadline, priority, fatigue level, and estimated minutes.
- Add reschedule and partial-complete flows.
