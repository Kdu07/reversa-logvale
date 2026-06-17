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

- `app/(public)/` — Login (email + password), activation-link callback (`auth/callback`), first-access (set password + accept terms)
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

XML downloads (the original NF and the client-uploaded return NF) are signed **on-click** by `getXmlDownloadUrlAction` (`lib/actions/xml-download.ts`) using Supabase's `download` option, so the response carries `Content-Disposition: attachment` and the file saves to the user's device (instead of opening inline) with an RV-based name from `xmlDownloadName` (`<RV>-nf-original.xml` / `<RV>-nf-devolucao.xml`). The shared `components/shared/download-xml-button.tsx` triggers it everywhere (admin, tratativas, client pending/history, operator review). Photos still use the eager batch (`buildSignedUrlMap`); only XMLs sign lazily, which is what lets each file get its own friendly filename.

### Business Logic

**Operator flow:** Barcode scanner (`hooks/use-barcode-scanner.ts`) captures return ID → operator photographs box and items via webcam (`components/shared/webcam-capture.tsx`) → the 44-digit access key is parsed locally (`lookupInvoice` in `lib/integrations/webmania.ts`) to derive emitter CNPJ / invoice number / emission month and auto-suggest the depositor — no external call → operator enters metadata. All in a 7-step wizard at `app/(operator)/operador/recebimento/`.

**Client flow:** Clients review returns in `awaiting_decision` status and choose: return / discard / repackage / store for handling. Auto-decision fires after 72 hours (pg_cron in the database).

**Return status lifecycle:** `awaiting_decision` → `decided` → `processed`

### Integrations

- **Webmania** (`lib/integrations/webmania.ts`): currently `lookupInvoice` parses the access key locally (no external call, no retry, no cache). External NF/XML consultation is a **planned** integration — `fetchInvoiceXml()` is a stub consumed by the super-only retry action (`retryMissingInvoiceXmlAction`) that backfills missing XMLs. The `WEBMANIA_*` env vars are reserved for that future integration.
- **Resend** (`lib/integrations/resend.ts`): Transactional email using React Email templates in `emails/`.
- **Sentry**: Configured in `next.config.mjs` for error tracking.

### Background Jobs

- **pg_cron (database):** Auto-decision after 72h, defined in migrations.
- **Supabase Edge Functions:** `supabase/functions/warning-email/` (hourly, warns clients of pending decisions), `supabase/functions/photo-cleanup/` (daily, removes orphaned storage files).
- **Super-only NF retry:** the `/admin/devolucoes` page shows a panel (super users only) to batch-fetch the XMLs of access-key returns still missing one (`MissingXmlPanel` + `retryMissingInvoiceXmlAction`); a no-op until the external NF consultation API is implemented.

### Key Database Tables

`profiles` (users + roles), `depositors` (CNPJ companies), `returns` (shipments), `return_photos`, `invoice_cache` (legacy — present in the schema but currently unused), `client_depositors` (N:N clients ↔ depositors). Schema in `supabase/migrations/000_schema.sql`.

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
# WEBMANIA_* — reserved for the planned external NF consultation; not used by the code yet
WEBMANIA_CONSUMER_KEY, WEBMANIA_CONSUMER_SECRET, WEBMANIA_ACCESS_TOKEN, WEBMANIA_ACCESS_TOKEN_SECRET
WEBMANIA_BASE_URL  (default: https://webmaniabr.com/api)
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
- `docs/TEST-PLAN.md` — Coverage strategy, ratchet thresholds, and phased test backlog (target: 80%)
