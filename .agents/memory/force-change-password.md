---
name: Forced password-change enforcement
description: Why force-change-on-next-login must be enforced in requireAuth, not just the login UI
---

# Forced password-change must be enforced server-side

The `users.must_change_password` flag is enforced inside `requireAuth`
(`artifacts/api-server/src/middlewares/auth.ts`): when set, the middleware returns
403 `{error, mustChangePassword:true}` for every request except an allowlist of
auth endpoints (`/api/auth/change-password`, `/api/auth/logout`, `/api/auth/me`).
The allowlist is matched against `req.originalUrl` (query stripped) because the
router is mounted at `/api`.

**Why:** `POST /auth/login` still issues a full, valid session token even when the
user must change their password (needed so the client can call change-password).
If enforcement lived only in the login UI (gating navigation), any holder of that
token could bypass the change screen and call protected endpoints directly. The
UI gate is a mirror, not the control.

**How to apply:** Never treat a client-side "must change password / onboarding /
step-up" gate as a security boundary. If a valid token is issued before a required
step, the required step must be enforced in the auth middleware. When adding new
endpoints a pending-change user legitimately needs, extend the allowlist rather
than weakening the check.
