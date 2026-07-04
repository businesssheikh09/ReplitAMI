# System Architecture

## Overview

Al Musafir International is a **pnpm monorepo** with a single Express 5 API serving three React frontends via a Replit reverse proxy. All traffic enters through a shared proxy on port 80 and is routed by path prefix.

```
Internet / Browser
       │
       ▼
 Replit Proxy :80
  ┌────────────────────────────────────────────┐
  │  /api/*   →  api-server :8080              │
  │  /erp/*   →  umrah-erp  :PORT             │
  │  /*       →  frontend   :PORT             │
  └────────────────────────────────────────────┘
```

Paths are matched **most-specific first** and are **not rewritten** — each service handles its full base path.

---

## Service Topology

### `artifacts/api-server` — Express 5 API
- **Port**: reads `PORT` env var (default 8080 in production artifact config)
- **Entry**: `src/index.ts` → creates HTTP server, registers scheduled services, starts listening
- **App setup**: `src/app.ts` → mounts middleware (JSON body, CORS, Pino HTTP logger), then `routes/index.ts`
- **Build**: esbuild bundles to `dist/index.mjs` (CJS-style ESM); source maps emitted alongside
- **Logging**: Pino — `req.log` in route handlers, `logger` singleton elsewhere. Authorization and Cookie headers are redacted in production.

### `artifacts/umrah-erp` — ERP (Vite + React)
- Staff-facing application. Served as a static SPA after `vite build`.
- All API calls go to `/api/*` (relative, resolved through the shared proxy).
- Auth: ERP session token stored in `localStorage`; heartbeat every 2 minutes; 10-minute inactivity timeout.

### `artifacts/frontend` — Public Website (Vite + React)
- Customer-facing site: landing page, flight search, package pages, and customer portal.
- Same API base — relative `/api/*` paths.
- Auth: Portal session token stored in `localStorage`.

### `artifacts/mockup-sandbox` — Design Sandbox (Vite)
- Isolated Vite server for UI component previews. Not part of the main product flow.

---

## Shared Libraries

| Package | Role |
|---|---|
| `lib/db` | Drizzle ORM schema, migration files, `drizzle.config.ts` |
| `lib/api-spec` | `openapi.yaml` (4 000+ lines), `orval.config.ts` |
| `lib/api-zod` | Generated Zod schemas (from Orval) |
| `lib/api-client-react` | Generated TanStack Query hooks (from Orval) |

Libs are **composite** TypeScript projects. They emit declarations (`tsc --build`). Artifacts are **leaf** projects checked with `tsc --noEmit`.

---

## Request Flow — Typical ERP Request

```
ERP React → fetch /api/clients
  → Replit Proxy (port 80)
  → api-server (port 8080)
  → requireAuth middleware (validates session_token in users table)
  → routes/clients.ts handler
  → Drizzle ORM → PostgreSQL
  → JSON response
  → TanStack Query cache update
  → React re-render
```

## Request Flow — Portal Receipt Upload

```
Customer → clicks "Upload Receipt"
  → frontend page: POST /api/storage/uploads/request-url
  → api-server storage.ts → Replit GCS sidecar (127.0.0.1:1106)
  → returns { uploadURL, objectPath }
  → frontend: PUT file directly to presigned uploadURL (GCS)
  → frontend: POST /api/public/payment-receipts { inquiryId, objectKey }
  → booking-inquiries.ts: verifies receipt.portalUserId === req.portalUser.id
  → updates payment_receipts table
```

## Request Flow — WhatsApp Bot Campaign

```
Staff creates campaign → POST /api/bot/campaign
  → POST /api/bot/campaign/:id/start
  → bot-scheduler.ts (setInterval 5s)
    → reads bot_campaigns table
    → for each contact: whatsapp.ts.sendMessage()
    → inserts bot_campaign_sends row
    → updates current_index + next_send_at
```

---

## Adapter Pattern (GDS / Flight Inventory)

```typescript
interface TicketInventoryAdapter {
  id: string
  name: string
  isEnabled(): Promise<boolean>
  fetchAvailability(flightNumber: string, date: string): Promise<AdapterResult>
}
```

`adapters/registry.ts` maintains the list. `getEnabledAdapters()` is called by the inventory sweep. The `stubAdapter` in `stub.ts` is the template for real GDS connectors.

Live flight search (`flight-search.ts`) queries Amadeus, Sabre, and Galileo directly via their SDKs, aggregates results, and applies markup before returning.

---

## Object Storage Architecture

Storage uses **Google Cloud Storage** via a Replit-managed sidecar:

```
api-server → POST http://127.0.0.1:1106/token   ← get GCS access token
api-server → PUT  presigned URL                  ← client uploads directly
api-server → GET  http://127.0.0.1:1106/sign     ← get signed download URL
```

- **Public objects**: searched across `PUBLIC_OBJECT_SEARCH_PATHS` paths
- **Private objects**: stored under `PRIVATE_OBJECT_DIR` prefix
- **ACL**: stored as JSON in object metadata key `custom:aclPolicy`
  - `visibility: "public"` → anyone can read
  - `visibility: "private"` → owner or explicit `aclRules` only
  - Permissions: `READ`, `WRITE` (WRITE implies READ)

---

## Authentication Architecture

### ERP Auth
- `POST /api/auth/login` — validates email + bcrypt password, writes a UUID `session_token` to `users.session_token`
- `requireAuth` middleware — reads `Authorization: Bearer <token>`, looks up user by token, attaches `req.user`
- Roles: `sales`, `accounts`, `operations`, `management`, `admin`

### Portal Auth
- `POST /api/portal/login` — validates portal user credentials (bcrypt, with legacy plain-text fallback), returns `portal_session_token`
- `requirePortalAuth` middleware — reads `Authorization: Bearer <token>`, looks up portal user by `portal_session_token`, attaches `req.portalUser` (includes `id`, `type`, `clientId`)
- Portal user types: `party` (travel agencies), `dc` (direct customers)
- Portal user statuses: `pending_approval`, `approved`, `rejected`, `suspended`

---

## Scheduled Services

| Service | Mechanism | Schedule |
|---|---|---|
| `automation-scheduler.ts` | node-cron | Per-automation cron (see AUTOMATION.md) |
| `bot-scheduler.ts` | setInterval | Every 5 seconds |
| `hold-expiry.ts` | setInterval | Every 5 minutes |
| `inventory-sweep.ts` | setInterval | Every 10 minutes |
| `scheduler.ts` (group ticket scraper) | node-cron | Daily 13:00 |

---

## Codegen Pipeline

```
lib/api-spec/openapi.yaml
       │
       ▼
  orval.config.ts
  ┌─────────────────────────────────────────┐
  │  → lib/api-client-react/src/generated/  │  (React Query hooks)
  │  → lib/api-zod/src/generated/           │  (Zod schemas + TS types)
  └─────────────────────────────────────────┘
```

Run: `pnpm --filter @workspace/api-spec run codegen`

Generated code uses a custom fetch mutator (`custom-fetch.ts`) that attaches the ERP session token automatically.

---

## Known Limitations

- WhatsApp integration uses an unofficial Baileys library. Session persistence requires the `whatsapp-session/` directory.
- GDS adapters for Sabre and Galileo have credential configuration but live testing depends on account access.
- The Amadeus SDK type definitions are hand-authored (`types/amadeus.d.ts`); the package does not ship official types.
- Object storage sidecar runs locally at `127.0.0.1:1106` — only available in the Replit environment; self-hosting requires replacing this with a standard GCS client.
- Portal statement endpoint derives running balance from `voucher_lines` (not `general_journal`), so it only reflects posted vouchers, not auto-journal entries.
