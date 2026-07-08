# Al Musafir International — Umrah Travel ERP

Full-stack Umrah travel agency platform: ERP for staff (clients, quotations, hotels, flights, visa, transport, accounting, WhatsApp automation) + public website with flight booking + customer portal.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/routes/` — all API route handlers (one file per domain)
- `artifacts/umrah-erp/src/pages/` — all ERP page components (50+ pages)
- `artifacts/frontend/src/pages/` — public website + portal pages
- `lib/db/src/schema/` — Drizzle table definitions (source of truth for DB shape)
- `artifacts/api-server/src/routes/vouchers.ts` — double-entry voucher system (RV/PV/JV/CV types, lines[] required)
- `artifacts/api-server/src/routes/portal.ts` — portal user auth (type: "party"|"dc", emailOrPhone login)
- `artifacts/api-server/src/routes/portal-customer.ts` — portal-authenticated customer endpoints

## Architecture decisions

- Passwords are stored as bcrypt hashes (`users.password_hash`, `$2b$`). `verifyPassword()` (`artifacts/api-server/src/lib/security.ts`) accepts a bcrypt hash, and falls back to plaintext comparison only for un-migrated rows during the migration window.
- `migratePlaintextPasswords()` runs on server startup (after seed, in `index.ts`) and is idempotent — it only re-hashes rows where `isBcryptHash()` is false.
- Forced password change (`users.must_change_password`) is enforced **server-side** in `requireAuth`: a user with the flag set is blocked (403 `{mustChangePassword:true}`) from every endpoint except an allowlist (`/api/auth/change-password`, `/api/auth/logout`, `/api/auth/me`). The ERP login UI mirrors this by gating navigation. Never rely on the UI alone.
- Security events are recorded in `auth_audit_log` (`event` column: `login_success`, `login_failed`, `password_change`, `password_reset`, `user_created`) via `writeAuthAudit()`.
- Custom auth endpoints (change-password, reset-password) are called from the ERP via direct `fetch("/api/...", {Authorization: Bearer})`, NOT via generated OpenAPI hooks, to avoid changing the API contract/spec.

## Product

Al Musafir International — an Umrah travel agency ERP. Staff (roles: management, sales, accounts, operations) manage clients, quotations, hotels, flights, visas, transport, accounting, and WhatsApp automation. A public website + customer portal (in `artifacts/frontend`) exposes packages and portal features. Access to ERP endpoints requires authentication; a few routes are public (`/currency/rates`, `/public/hotels`, `/website-config`).

## User preferences

- Do NOT push to GitHub until the user explicitly approves.

## Security & Ops

- **CORS**: production origin allowlist is `https://erp.almusafirinternational.com`, `https://portal.almusafirinternational.com`, `https://almusafirinternational.com`, `https://www.almusafirinternational.com` (set via `NODE_ENV=production` in `artifacts/api-server/src/app.ts`). In non-production, any `localhost` origin is allowed.
- **Rate limiting**: `/api/auth/login` and `/api/portal/login` are limited to 10 requests/IP per 15 min; all other `/api/auth/*` routes to 30/IP per 15 min (`artifacts/api-server/src/middlewares/rate-limit.ts`). `app.set("trust proxy", 1)` in `app.ts` is required for this to key off real client IPs — Replit's shared reverse proxy sets `X-Forwarded-For`, so leaving `trust proxy` at its default (false) breaks IP-based rate limiting.
- **Test data cleanup**: `pnpm --filter @workspace/scripts run cleanup-test-data` (dry run) / `-- --confirm` (delete) removes obvious QA/smoke test clients, `TEST-REG*`/`REGDN*`/`REGRDN*` hotel invoices, and known test user accounts. It only deletes rows with zero related records elsewhere — anything with real activity is skipped and reported for manual review, never force-deleted.
- **DB backups**: `pnpm --filter @workspace/scripts run backup-db` dumps Postgres to `backups/<timestamp>.sql.gz` (gitignored) and prunes backups older than 14 days. Schedule it daily via an OS cron entry or the existing node-cron scheduler in api-server. Restore with `gunzip -c backups/<file>.sql.gz | psql "$DATABASE_URL"`.
- **Deployment target**: this app should be deployed on a **Reserved VM**, not Autoscale. The api-server runs stateful background work (node-cron scheduled jobs, a persistent WhatsApp/Baileys session under `artifacts/api-server/whatsapp-session/`) that would be lost or duplicated across Autoscale's ephemeral, multi-instance scaling.

## Gotchas

- ERP endpoints must use `requireAuth`; only intentionally public routes stay open. Verify with an unauth request expecting 401.
- api-server runs via a build+start workflow using esbuild (transpile-only), so it runs despite ~33 pre-existing `string|string[]` typecheck errors in route handlers. Do not add new ones — use `parseInt(String(req.params.id))`.
- After changing DB schema, run `pnpm --filter @workspace/db run push` (dev only).
- Voucher creation requires: `type` ("RV"|"PV"|"JV"|"CV"), `date`, `narration`, and `lines[]` with at least 2 balanced entries (DR=CR). Not a simple debit/credit field API.
- Quotation ref numbers (`generateRef()`) are now async and query max existing ref from DB — required since the in-memory counter resets on every server restart.
- Numeric fields like `amount` in transport/flight routes use `(req.body.amount ?? 0).toString()` guard to avoid `.toString()` crash on undefined.
- Portal user type must be `"party"` or `"dc"` (not `"customer"`). Login uses `emailOrPhone` field, not `email`. New party accounts start as `"pending_approval"`.
- `/portal/dashboard` requires portal session token (Bearer from portal login), not ERP staff token — returns 401 with staff token by design.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
