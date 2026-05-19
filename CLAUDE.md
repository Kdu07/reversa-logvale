# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on :3000
npm run build        # Production build
npm run lint         # ESLint (next/core-web-vitals)
npm test             # Run unit tests once (vitest run)
npm run test:ui      # Interactive test runner with UI dashboard
npm run coverage     # Unit test coverage report
npm run test:e2e     # Run Playwright E2E tests
```

**Running a single test file:**
```bash
npx vitest run __tests__/actions/create-return.test.ts
npx vitest run __tests__/lib/format.test.ts
```

**Type checking:**
```bash
npx tsc --noEmit
```

## Architecture

**Stack:** Next.js 14 (App Router) + TypeScript + Supabase (Auth, PostgreSQL, Storage) + Tailwind CSS + shadcn/ui.

### Route Groups and Roles

The app enforces three user roles (`operator`, `client`, `manager`) injected into JWT claims via a Supabase Auth Hook (`supabase/migrations/002_auth_hook.sql`). Next.js middleware (`middleware.ts`) redirects unauthenticated users and enforces role-based routing:

- `app/(public)/` — Login, magic-link callback, first-access, terms acceptance
- `app/(operator)/operador/` — 7-step receiving workflow + item handling
- `app/(client)/cliente/` — Pending decisions dashboard + history
- `app/(manager)/admin/` — User/depositor management + system-wide stats

### Data Fetching Pattern

No API routes for business logic. All reads use Server Components with direct Supabase queries. All mutations use Server Actions (`actions.ts` files colocated in each route group) with `revalidatePath()` for cache busting.

Auth helpers:
- `lib/supabase/get-current-user.ts` — `getCurrentUser()` returns the authenticated user or redirects
- `lib/supabase/assert-role.ts` — `assertRole(role)` throws if the user doesn't have the required role

### Supabase Configuration

Three clients with different privilege levels:
- `lib/supabase/client.ts` — Browser-side (anon key, for client components)
- `lib/supabase/server.ts` — Server-side (anon key + cookie session, for server components/actions)
- `lib/supabase/admin.ts` — Admin (service role key, bypasses RLS — for manager operations only)

RLS isolates data per client. Storage buckets (`box-photos`, `item-photos`, `invoice-xmls`) are private; access requires signed URLs via `lib/supabase/storage.ts`.

### Business Logic

**Operator flow:** Barcode scanner (`hooks/use-barcode-scanner.ts`) captures return ID → operator photographs box and items via webcam (`components/shared/webcam-capture.tsx`) → Webmania API lookup fetches NF-e invoice data → operator enters metadata. All in a 7-step wizard at `app/(operator)/operador/recebimento/`.

**Client flow:** Clients review returns in `awaiting_decision` status and choose: return / discard / repackage / store for handling. Auto-decision fires after 72 hours (pg_cron in the database).

**Return status lifecycle:** `awaiting_decision` → `decided` → `processed`

### Integrations

- **Webmania** (`lib/integrations/webmania.ts`): NF-e lookup with 3x retry and `invoice_cache` table caching.
- **Resend** (`lib/integrations/resend.ts`): Transactional email using React Email templates in `emails/`.
- **Sentry**: Configured in `next.config.mjs` for error tracking.

### Background Jobs

- **pg_cron (database):** Auto-decision after 72h, defined in migrations.
- **Supabase Edge Functions:** `supabase/functions/warning-email/` (hourly, warns clients of pending decisions), `supabase/functions/photo-cleanup/` (daily, removes orphaned storage files).

### Key Database Tables

`profiles` (users + roles), `depositors` (CNPJ companies), `returns` (shipments), `return_photos`, `invoice_cache`, `client_depositors` (N:N clients ↔ depositors). Schema in `supabase/migrations/000_schema.sql`.

### Testing Setup

Unit tests in `__tests__/` (Vitest). `vitest.setup.ts` mocks `next/cache`, `next/navigation`, and Supabase clients. E2E tests in `e2e/` (Playwright) spin up their own dev server.

### Environment Variables

Required to start the app:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

Optional (integrations):
```
WEBMANIA_API_TOKEN, WEBMANIA_CONSUMER_SECRET, WEBMANIA_BASE_URL
RESEND_API_KEY, RESEND_FROM_EMAIL
NEXT_PUBLIC_SENTRY_DSN, SENTRY_DSN
```

See `.env.example` for the full list and `docs/SETUP.md` for setup instructions.

## Project Docs

- `docs/PRD.md` — Product requirements and feature specs
- `docs/SETUP.md` — Local setup and deployment guide
- `docs/JOBS.md` — Scheduled jobs documentation
- `docs/DEPLOY.md` — Step-by-step deployment (Vercel)
- `docs/LGPD.md` — LGPD/privacy compliance notes
