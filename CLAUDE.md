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

RLS isolates data per client. Storage buckets (`box-photos`, `item-photos`, `invoice-xmls`, `invoice-pdfs`) are private; access requires signed URLs via `lib/supabase/storage.ts`.

XML/PDF downloads (the original NF XML, its DANFE PDF, and the client-uploaded return NF XML) are signed **on-click** by `getXmlDownloadUrlAction` (`lib/actions/xml-download.ts`, which takes an optional `bucket` param) using Supabase's `download` option, so the response carries `Content-Disposition: attachment` and the file saves to the user's device (instead of opening inline) with an RV-based name from `xmlDownloadName` (`<RV>-nf-original.xml` / `<RV>-nf-devolucao.xml`) or `danfeDownloadName` (`<RV>-danfe.pdf`). The shared `components/shared/download-xml-button.tsx` (with optional `bucket` prop) triggers it everywhere (admin, tratativas, client pending/history, operator review). Photos still use the eager batch (`buildSignedUrlMap`); only the fiscal files sign lazily, which is what lets each file get its own friendly filename.

### Business Logic

**Operator flow:** Barcode scanner (`hooks/use-barcode-scanner.ts`) captures return ID → operator photographs box and items via webcam (`components/shared/webcam-capture.tsx`) → the 44-digit access key is parsed locally (`lookupInvoice` in `lib/integrations/nfeio.ts`) to derive emitter CNPJ / invoice number / emission month and auto-suggest the depositor (by emitter CNPJ); the same call fetches the NF XML + DANFE PDF from NFEio and persists them to storage (best-effort — a NFEio failure never blocks receiving) → operator enters metadata. All in a 7-step wizard at `app/(operator)/operador/recebimento/`.

**Client flow:** Clients review returns in `awaiting_decision` status and choose: return / discard / repackage / store for handling. Auto-decision fires after 72 hours (pg_cron in the database).

**Return status lifecycle:** `awaiting_decision` → `decided` → `processed`

### Integrations

- **NFEio** (`lib/integrations/nfeio.ts`): NF-e consultation by access key. `lookupInvoice` parses the access key locally (emitter CNPJ → depositor) and calls `persistInvoiceFiles`, which fetches the XML (`GET {base}/v2/productinvoices/{key}.xml`) and DANFE PDF (`.pdf`) and uploads them (admin client, upsert) to `invoice-xmls`/`invoice-pdfs` at `ak/<key>.{xml,pdf}`. Auth is the `NFEIO_ACCESS_KEY` (the company API key) sent in the `Authorization` header. `fetchInvoiceXml`/`fetchInvoicePdf` are also reused by the super-only `retryMissingInvoiceXmlAction` to backfill returns whose XML is still missing. All fetches degrade gracefully: when `env.nfeioEnabled` is false (no key) or NFEio returns an error, receiving still completes and the files stay pending for backfill.
- **Email/SMTP** (`lib/integrations/email.ts`): Transactional email via Nodemailer over SMTP (Google Workspace), using React Email templates in `emails/`. Gated by `env.mailEnabled` (true when `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` are set); when off, account-creation still surfaces the activation link for manual sending. The `warning-email` Edge Function (Deno) sends via `denomailer` over the same SMTP creds.
- **Sentry**: Configured in `next.config.mjs` for error tracking.

### Background Jobs

- **pg_cron (database):** Auto-decision after 72h, defined in migrations.
- **Supabase Edge Functions:** `supabase/functions/warning-email/` (hourly, warns clients of pending decisions), `supabase/functions/photo-cleanup/` (daily, removes orphaned storage files).
- **Super-only NF retry:** the `/admin/devolucoes` page shows a panel (super users only) to batch-fetch the XML + DANFE of access-key returns still missing one (`MissingXmlPanel` + `retryMissingInvoiceXmlAction`); reports `disabled` when `NFEIO_ACCESS_KEY` is unset.

### Key Database Tables

`profiles` (users + roles), `depositors` (CNPJ companies), `returns` (shipments; `invoice_xml_url` + `invoice_pdf_url` hold the NFEio XML/DANFE storage paths, `return_invoice_xml_url` the client-uploaded return NF), `return_photos`, `invoice_cache` (legacy — present in the schema but currently unused), `client_depositors` (N:N clients ↔ depositors). Schema in `supabase/migrations/000_schema.sql`; `invoice_pdf_url` + the `invoice-pdfs` bucket are added in `003_nfeio_pdf.sql`.

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
# NFEio — NF-e consultation (XML + DANFE) in the operator flow.
# NFEIO_ACCESS_KEY is the company API key, sent in the `Authorization` header. Unset = disabled.
NFEIO_ACCESS_KEY
NFEIO_BASE_URL  (default: https://nfe.api.nfe.io)
# Email via SMTP (Google Workspace). mailFrom falls back to legacy RESEND_FROM_EMAIL if set.
SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, MAIL_FROM
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
