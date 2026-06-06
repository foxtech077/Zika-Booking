# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Run individual apps/services
```bash
pnpm dev:web        # apps/web on :3000
pnpm dev:provider   # apps/provider on :3005
pnpm dev:admin      # apps/admin on :3002
pnpm dev:auth       # services/auth-service on :3001
pnpm dev:listing    # services/listing-service on :3003
pnpm dev:backend    # auth + listing services together
pnpm dev            # everything via Turborepo TUI
```

### Build / type-check / lint
```bash
pnpm build                                              # all packages
pnpm typecheck                                          # all packages
pnpm lint                                               # all packages
pnpm --filter @zika/web typecheck                       # single app
pnpm --filter @zika/listing-service typecheck
```

### Database (Prisma)
```bash
pnpm db:migrate          # runs migrate dev on all services
pnpm db:generate         # regenerates Prisma clients
pnpm db:studio:auth      # opens Prisma Studio for auth-service DB
pnpm db:studio:listing   # opens Prisma Studio for listing-service DB
pnpm db:seed:auth        # seed auth-service
pnpm db:seed:all         # seed all
```

Each service (auth-service, listing-service) has its own separate PostgreSQL database and Prisma schema.

## Architecture

### Monorepo structure (Turborepo + pnpm workspaces)
```
apps/
  web/        Next.js 14 — traveller-facing site + provider dashboard (App Router, port 3000)
  provider/   Next.js 14 — dedicated provider portal (App Router, port 3005)
  admin/      Next.js 14 — admin panel (port 3002)
  mobile/     Expo/React Native
services/
  auth-service/     Fastify — authentication, users, JWT/refresh, Google OAuth
  listing-service/  Fastify — listings, bookings, photos, documents, messaging, iCal
  payment-service/  Fastify — (in progress)
packages/
  types/       Shared TypeScript types (compiled, referenced as @zika/types)
  validators/  Shared Zod validators (@zika/validators)
```

### API routing (Next.js rewrites)
Both `apps/web` and `apps/provider` proxy via `next.config.mjs` rewrites:
- `/api/*` → auth-service (`NEXT_PUBLIC_API_URL`, default `localhost:3001`)
- `/listing-api/*` → listing-service (`NEXT_PUBLIC_LISTING_API_URL`, default `localhost:3003`)

Frontend code never calls services directly — always through these proxied paths.

### Auth pattern
- JWT stored in `sessionStorage` under key `zika:access_token`
- Zustand store (`stores/auth.ts`) persists token + user via `sessionStorage`
- Axios instances: `lib/api.ts` (auth service), `lib/listing-api.ts` (listing service) — both auto-attach Bearer token
- Token refresh: hit `/api/auth/refresh` (POST, uses httpOnly refresh cookie). Pages that need auth implement a `withTokenRefresh()` wrapper that catches 401 and retries after refreshing.
- Provider dashboard (`app/(provider)/dashboard/layout.tsx` in web, `app/dashboard/layout.tsx` in provider) enforces `userType === "provider"` and redirects to `/auth/login` if unauthenticated.

### Listing service data flow
1. **Create**: `POST /listings` with `{ category }` → returns `{ id, category, status: "draft" }`
2. **Edit**: `PATCH /listings/{id}` — all fields optional, geocoding triggered server-side when address changes
3. **Photo upload** (3-step): presign → PUT direct to S3 → confirm
   - `POST /listings/{id}/photos/presign` → `{ uploadUrl, s3Key }`
   - PUT to `uploadUrl` with file binary
   - `POST /listings/{id}/photos/confirm` with `{ s3Key }` → photo record
4. **Document upload** (same 3-step pattern): presign → S3 → confirm. Document types: `business_licence`, `operating_permit`, `hotel_operating_permit`, `tourism_certificate`, `insurance_certificate`, `roadworthiness_certificate`, `tourism_authority_certificate`, `vehicle_registration`
5. **Status transitions**: hotels go `draft → pending_review → approved → active`; apartments/cars go `draft → active` directly. Reactivate = POST `/reactivate` (not `/activate`) for previously deactivated listings.

### Frontend state management
- **React Query** (`@tanstack/react-query`) for all server state. Query keys live in `hooks/listings/index.ts` under `LISTING_QK`.
- **Zustand** for client-only state: `stores/auth.ts` (session), `stores/listings/index.ts` (wizard draft progress — persisted to sessionStorage under `zika:listing-wizard`).
- `QueryClientProvider` is set up in `app/providers.tsx` with `staleTime: 30_000` default.

### Listing form architecture (`apps/web` and `apps/provider` are mirrors)
The edit page (`dashboard/listings/[id]/edit/page.tsx`) is a tabbed multi-step form:
- Tabs: `basic` → `pricing` → `amenities` → `specs` → `media`
- Tabs lock sequentially: later tabs require earlier tabs to pass `validateStep()`
- All saves are `PATCH /listings/{id}` — no full-form submit, each tab saves independently
- `MediaUploader` handles photos; `DocumentUploader` handles compliance documents
- Both uploaders implement the presign → S3 PUT → confirm flow internally

### UI component library (shared pattern in both web and provider)
All UI primitives live in `components/ui/`:
- `Button` — variants: `primary | secondary | danger | ghost | outline | success`
- `Input`, `Textarea`, `Select` — all accept `label`, `error`, `hint` props
- `Badge` — auto-derives color variant from status string via `getVariantFromStatus()`
- `Card`, `SectionHeader`, `CardHeader` — layout primitives
- `DataTable` + `FilterBar` + `Pagination` — table system in `components/tables/`
- `SlideDrawer` — right-side slide panel
- `ConfirmModal` — confirmation dialog

Tailwind is configured with semantic color tokens: `primary`, `success`, `warning`, `danger`, `info`, `surface`, `border`, `zika.*` (brand colors). Always use these tokens rather than raw Tailwind color classes.

### Geocoding
Address geocoding is server-side in `listing-service/src/lib/geocoding.ts`. The PATCH endpoint accepts `address` and optionally `lat`/`lng`. If only address is provided, the service geocodes it. `lat` and `lng` are required for hotel submission validation.

### S3 / file uploads
- Bucket: `zika-storage`, region: `af-south-1`
- CDN base URL: `https://zika-storage.s3.af-south-1.amazonaws.com`
- All config via env vars: `AWS_REGION`, `S3_BUCKET_NAME`, `S3_CDN_BASE_URL`
- Backend (`services/listing-service/src/lib/s3.ts`) is the only place that generates presigned URLs or constructs CDN URLs. Frontend never constructs S3 URLs.
- Photo content types: `image/jpeg`, `image/png`, `image/webp` (max 10 MB)
- Document content types: same images + `application/pdf`

### apps/web vs apps/provider
Both apps are nearly identical in structure — same component library, same hooks, same service layer. `apps/web` hosts the provider dashboard under the `(provider)` route group alongside the traveller-facing pages. `apps/provider` is a standalone provider-only portal. Keep changes in sync between the two when modifying shared listing management logic.
