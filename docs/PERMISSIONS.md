# Permissions

**Purpose**: Role-based access control (RBAC) for the ERP application — controlling which pages a user can visit and which actions they can perform.  
**File**: `artifacts/umrah-erp/src/lib/permissions.ts`  
**Auth context**: `artifacts/umrah-erp/src/lib/auth.tsx`  
**Gate component**: `ProtectedRoute` in `artifacts/umrah-erp/src/App.tsx`  

---

## Roles

| Role | Description |
|---|---|
| `sales` | Sales staff — CRM, quotations, hotel requests |
| `accounts` | Finance staff — invoices, vouchers, journal, reports |
| `operations` | Operations team — flights, transport, visa, documents |
| `management` | Managers — full ERP access |
| `admin` | System administrator — all access including settings |

> `management` and `admin` bypass all permission checks. They always have access to every page and every action.

---

## ERP Auth Flow

1. User logs in via `POST /api/auth/login`
2. Server returns `{ token, user: { id, name, email, role, ... } }`
3. `AuthProvider` stores `user` in React context and `localStorage`
4. `ProtectedRoute` wraps all authenticated pages:
   - Checks if `user` is set (redirect to `/login` if not)
   - Calls `canAccess(user.role, routePath)` to validate route permission
   - Redirects to `/dashboard` if access is denied
5. Heartbeat: `GET /api/auth/me` every 2 minutes validates session is still active
6. Inactivity: 10-minute mousemove/keydown listener auto-logs out on inactivity

---

## Route Permissions (`ROUTE_PERMISSIONS`)

The `ROUTE_PERMISSIONS` map defines which roles can access each route path.

| Route | sales | accounts | operations | management | admin |
|---|---|---|---|---|---|
| `/dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/crm` | ✓ | | ✓ | ✓ | ✓ |
| `/crm/:id` | ✓ | | ✓ | ✓ | ✓ |
| `/quotations` | ✓ | | ✓ | ✓ | ✓ |
| `/quotations/pending` | ✓ | | ✓ | ✓ | ✓ |
| `/hotel-requests` | ✓ | | ✓ | ✓ | ✓ |
| `/hotels` | | | ✓ | ✓ | ✓ |
| `/vendors` | | | ✓ | ✓ | ✓ |
| `/flights` | ✓ | | ✓ | ✓ | ✓ |
| `/flight-requests` | ✓ | | ✓ | ✓ | ✓ |
| `/transport` | | | ✓ | ✓ | ✓ |
| `/visa` | | | ✓ | ✓ | ✓ |
| `/passenger-documents` | | | ✓ | ✓ | ✓ |
| `/cancellations-refunds` | | | ✓ | ✓ | ✓ |
| `/booking-inquiries` | ✓ | | ✓ | ✓ | ✓ |
| `/portal-users` | | | | ✓ | ✓ |
| `/accounting` | | ✓ | | ✓ | ✓ |
| `/accounting/invoices` | | ✓ | | ✓ | ✓ |
| `/accounting/expenses` | | ✓ | | ✓ | ✓ |
| `/accounting/vouchers` | | ✓ | | ✓ | ✓ |
| `/general-journal` | | ✓ | | ✓ | ✓ |
| `/accounting/ledger` | | ✓ | | ✓ | ✓ |
| `/accounting/trial-balance` | | ✓ | | ✓ | ✓ |
| `/accounting/pnl` | | ✓ | | ✓ | ✓ |
| `/accounting/balance-sheet` | | ✓ | | ✓ | ✓ |
| `/accounting/financial-years` | | ✓ | | ✓ | ✓ |
| `/currency` | | ✓ | | ✓ | ✓ |
| `/reports` | | ✓ | | ✓ | ✓ |
| `/bsp-report` | | | | ✓ | ✓ |
| `/staff-ticket-log` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/whatsapp-inbox` | | | | ✓ | ✓ |
| `/bot-campaigns` | | | | ✓ | ✓ |
| `/media-library` | | | | ✓ | ✓ |
| `/automation-settings` | | | | ✓ | ✓ |
| `/automation-logs` | | | | ✓ | ✓ |
| `/users` | | | | | ✓ |
| `/gds-settings` | | | | | ✓ |
| `/ai-settings` | | | | ✓ | ✓ |
| `/local-airline-settings` | | | | | ✓ |
| `/website-settings` | | | | ✓ | ✓ |

---

## Action Permissions (`ACTION_PERMISSIONS`)

Fine-grained permissions checked via `canDo(role, action)` for specific UI actions:

| Action | sales | accounts | operations | management | admin |
|---|---|---|---|---|---|
| `viewPassport` | | | ✓ | ✓ | ✓ |
| `verifyDocuments` | | | ✓ | ✓ | ✓ |
| `refundTicket` | | | | ✓ | ✓ |
| `cancelTicket` | | | | ✓ | ✓ |
| `approveVoucher` | | | | ✓ | ✓ |
| `postVoucher` | | ✓ | | ✓ | ✓ |
| `closeFinancialYear` | | | | ✓ | ✓ |
| `manageUsers` | | | | | ✓ |
| `manageGdsSettings` | | | | | ✓ |
| `issuePinTicket` | varies | varies | varies | ✓ | ✓ |

> `issuePinTicket` also requires `user.can_issue_tickets = true` (a per-user flag set by admin) plus a valid ticketing PIN. Management and Admin roles still need `can_issue_tickets = true` for the PIN path.

---

## Backend Auth Middleware

### `requireAuth` (`src/middlewares/auth.ts`)

All ERP API routes use this middleware:

```typescript
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const user = await db.select().from(usersTable)
    .where(eq(usersTable.sessionToken, token)).limit(1)
  if (!user[0] || !user[0].isActive) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user[0]
  next()
}
```

Role-specific checks are done inline in each route handler:
```typescript
if (!['management', 'admin'].includes(req.user.role)) {
  return res.status(403).json({ error: 'Forbidden' })
}
```

### `requirePortalAuth` (`src/middlewares/portal-auth.ts`)

Portal customer endpoints use this middleware:

```typescript
async function requirePortalAuth(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const portalUser = await db.select().from(portalUsersTable)
    .where(eq(portalUsersTable.portalSessionToken, token)).limit(1)
  if (!portalUser[0] || portalUser[0].status !== 'approved') {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  req.portalUser = portalUser[0]  // includes id, type, clientId
  next()
}
```

---

## Ticketing PIN System

Ticket issuance is a high-value irreversible action — it requires two factors:

1. **User-level permission**: `users.can_issue_tickets = true` (set by admin via `PATCH /api/users/:id`)
2. **PIN verification**: `users.ticketing_pin` (bcrypt-hashed PIN stored in DB)

**PIN setup**: Admin sets a PIN for a user via the user management page  
**PIN entry**: On ticket issuance, staff enter their PIN in the ERP UI  
**Validation**: API compares entered PIN against stored bcrypt hash

This applies to both:
- `POST /api/flight-requests/:id/issue-ticket`
- `POST /api/flights/issue-ticket` (direct GDS issuance)

---

## Department Seeding

`src/lib/seed-departments.ts` ensures standard departments exist in the database:

| Department | Roles with access |
|---|---|
| Sales | sales |
| Accounts | accounts |
| Operations | operations |
| Management | management, admin |

This is called on server startup to ensure consistent data.

---

## Known Limitations

- The `admin` role is not a DB-enforced enum value — it is accepted by the `requireAuth` middleware alongside the four DB roles. An admin can be created by directly inserting or updating the role in the database.
- There is no per-department access control — only the five roles listed above.
- Session tokens (`users.session_token`) are single UUIDs — no multi-device session management. Logging in from a new device invalidates the previous session.
- The 10-minute inactivity timeout runs client-side only — a direct API call with a valid token still succeeds even after the frontend has logged out.
- `management` role bypasses all `canAccess()` checks on the frontend, but backend route handlers still check the role explicitly for destructive actions (closing years, approving vouchers, etc.).

---

## Future Extension Points

- Per-user route overrides (grant a `sales` user access to a specific finance page)
- Multi-device session management (allow N concurrent sessions per user)
- Audit log for all role/permission changes
- Department-level access control (instead of pure role-based)
- Two-factor authentication for admin and management roles
- Session IP binding for sensitive roles
