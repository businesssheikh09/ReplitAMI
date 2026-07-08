---
name: Express sub-router middleware leaks path scope
description: router.use(middleware) with no path inside a domain sub-router applies to every route mounted after it, not just that sub-router's own paths, when the sub-router itself is mounted with router.use(subRouter) (no prefix).
---

If a domain router (e.g. `auth.ts`) is mounted into a parent router via `router.use(authRouter)` (no path prefix — full paths like `/auth/login` are defined inside), then calling `authRouter.use(someMiddleware)` with no path applies `someMiddleware` to **every request that reaches the parent router**, not just `/auth/*` — because Express dispatches into the sub-router for any path when it's mounted at `/`, runs the middleware, then falls through to the next sibling router if nothing matches.

**Why:** Discovered when adding a rate limiter scoped to "auth routes" — `router.use(rateLimiter)` inside `auth.ts` silently rate-limited unrelated public endpoints (`/currency/rates`, `/website-config`) and every other API route, because `auth.ts`'s router is mounted with no prefix ahead of the other domain routers in `routes/index.ts`.

**How to apply:** When a domain router in this codebase (`artifacts/api-server/src/routes/*.ts`) needs router-level middleware (rate limiting, logging, etc.) that should only apply to that router's own paths, always scope it explicitly: `router.use("/auth", middleware)` (matching the path prefix used by that router's own route definitions), never a bare `router.use(middleware)`. Verify by curling an unrelated route immediately after — it must not be affected.
