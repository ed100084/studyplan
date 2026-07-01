# StudyPlan Agent Instructions

## Response Style

- Give the conclusion first; skip long prefaces and generic affirmation.
- Prefer tables and concise bullet points over long prose.
- Keep technical terms in English when they are standard in the codebase, such as `Server Actions`, `Prisma`, `Route Handlers`, `revalidatePath`, and `Asia/Taipei`.

## Project Shape

- This is a Next.js App Router app for a Traditional Chinese study planning product. User-facing copy should stay in Traditional Chinese unless existing surrounding copy is English.
- Core docs are linked from [README.md](README.md). Link to existing docs instead of duplicating them.
- Product and architecture context: [docs/requirements.md](docs/requirements.md), [docs/technical-plan.md](docs/technical-plan.md), [docs/scheduler-spec.md](docs/scheduler-spec.md).
- Database/auth/deployment context: [docs/database.md](docs/database.md), [docs/authentication.md](docs/authentication.md), [docs/deployment.md](docs/deployment.md).

## Commands

| Task | Command |
|---|---|
| Start dev server | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Test | `npm test` |
| Prisma validate | `npm run db:validate` |
| Prisma generate | `npm run db:generate` |
| Dev migration | `npm run db:migrate -- --name <migration-name>` |
| Deploy migrations | `npm run db:deploy` |
| Seed | `npm run db:seed` |

## Architecture Conventions

- Default to Server Components. Use `"use client"` only for browser APIs, local interactive state, `useTransition`, router refresh, print, or global navigation/form behavior.
- Server Actions are colocated by domain in `app/**/actions.ts` and usually end with `revalidatePath(...)` and `redirect(...)`.
- Route Handlers live in `app/**/route.ts` and use `NextRequest` / `NextResponse`.
- Shared domain logic belongs in `lib/`; keep pure, deterministic logic out of React when possible.
- Scheduler logic belongs in `lib/scheduler/`, should be pure and deterministic, and should not touch the database directly. See [docs/scheduler-spec.md](docs/scheduler-spec.md).
- Import the Prisma singleton from `lib/prisma.ts`; do not instantiate a new Prisma client.

## Auth And Data Safety

- Use the custom session helpers in `lib/session.ts`. Do not assume route boundaries are sufficient authorization.
- Server Components, Server Actions, and Route Handlers must each verify role and ownership before reading or mutating scoped data.
- For student-scoped mutations, follow the guarded pattern used in `app/schedule/actions.ts`: resolve editable student access, verify ownership with `findFirst`, then mutate by the verified record `id`.
- Guardian access must verify the `GuardianStudent` relationship. Student access must resolve the `StudentProfile` for the signed-in user.
- System admin logic uses helpers in `lib/system-admin.ts`; keep it separate from student/guardian flows.
- Preserve `authVersion` invalidation behavior for password, email, and security-sensitive changes.

## Dates And Timezones

- Default timezone is `Asia/Taipei`.
- Avoid raw `new Date("YYYY-MM-DD")` for user-facing dates.
- Use helpers from `lib/timezone.ts`, such as `getRequestTimeZone`, `zonedDateStart`, `formatDateInput`, `getDayRange`, `getWeek`, and `getMonth`.
- Query local-day ranges with `gte start` and `lt end`; do final recurring-event checks with the domain helpers.

## UI And Forms

- Reuse existing global CSS classes from `app/globals.css` instead of introducing a new styling system for small changes.
- Common classes include `shell`, `panel`, `form-card`, `button primary`, `button secondary`, `inline-actions`, `field-row`, `notice`, and `error-notice`.
- Forms usually use native `<form action={serverAction}>`.
- `FormSubmitGuard` injects `returnTo` and manages pending submit labels. Use `data-submit-guard="off"` only when a form manages its own pending state.
- Redirecting actions should use the existing `safeReturnTo(...)` pattern; never trust arbitrary external return URLs.

## Tests

- Tests use Node's built-in test runner via `tsx --test tests/**/*.test.ts`.
- Use `import test from "node:test"` and `import assert from "node:assert/strict"`.
- Favor pure library tests and security primitive tests over full Next rendering tests.
- Add focused tests when changing scheduler logic, timezone behavior, auth/session behavior, imports, ICS/calendar export, or Prisma URL handling.

## Versioning

- `package.json` is the single source of truth for app version.
- For version changes, follow [docs/versioning.md](docs/versioning.md): update `package.json`, update [CHANGELOG.md](CHANGELOG.md), confirm the homepage version, and run build validation.