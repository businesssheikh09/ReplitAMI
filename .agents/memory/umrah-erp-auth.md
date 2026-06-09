---
name: Umrah ERP auth pattern
description: Dev-only auth approach for the Umrah ERP
---

Simple token-based auth: token format is `token_{userId}_{timestamp}`. Stored in localStorage as `umrah_token`. No JWT signing in dev.

**Why:** Rapid prototyping — replace with bcrypt + proper JWT before production.

**How to apply:** `GET /api/auth/me` parses the token to extract userId. Any password or "admin123" is accepted in dev (see auth.ts route). Production must swap to bcrypt and signed JWT.

Default seed credentials: `admin@umrah.com` / `admin123`
