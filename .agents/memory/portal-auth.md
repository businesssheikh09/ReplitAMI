---
name: Portal Auth Pattern
description: How Party/DC portal user authentication works
---

Portal users (Party agencies and Direct Customers) use a separate auth system from ERP users.

**Token storage:** `portal_session_token` TEXT column on `portal_users` table — 32-byte hex Bearer token.

**Server middleware:** `requirePortalAuth` in `artifacts/api-server/src/middlewares/portal-auth.ts` — reads `Authorization: Bearer <token>` header, queries DB, attaches `req.portalUser`.

**Client side:** `artifacts/frontend/src/lib/portal-auth.ts` — `usePortalAuth()` hook with localStorage keys `portal_token` and `portal_user`.

**Routes:** `/api/portal/register`, `/api/portal/login`, `/api/portal/logout`, `/api/portal/me` — all public (no ERP auth). `/api/portal/users` and user management requires ERP `requireAuth`.

**Why:** Separate from ERP auth so travel agencies/customers can self-register without touching ERP user management.
