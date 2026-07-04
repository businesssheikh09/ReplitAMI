# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

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

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

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

## Gotchas

- ERP endpoints must use `requireAuth`; only intentionally public routes stay open. Verify with an unauth request expecting 401.
- api-server runs via a build+start workflow using esbuild (transpile-only), so it runs despite ~33 pre-existing `string|string[]` typecheck errors in route handlers. Do not add new ones — use `parseInt(String(req.params.id))`.
- After changing DB schema, run `pnpm --filter @workspace/db run push` (dev only).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
