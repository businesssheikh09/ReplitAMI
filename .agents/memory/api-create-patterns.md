---
name: API Create Operation Patterns
description: Common patterns and gotchas for POST handlers in api-server routes
---

## Numeric fields that need undefined guard

Any route that does `req.body.someNumber.toString()` will crash if the field is
not sent. Pattern to use: `(req.body.amount ?? 0).toString()`

Affected routes (already fixed):
- transport.ts: amount
- flights.ts: amount (flight-quotations)

**Why:** esbuild bundles the server; TypeScript optional types don't prevent
undefined at runtime. UI forms may not always send these optional fields.

**How to apply:** Whenever inserting a `numeric` DB column from `req.body`,
wrap with `(req.body.field ?? fallback).toString()` before calling `.returning()`.

## Reference number generators

In-memory counters (like `let refCounter = 1000`) reset on every server restart,
causing duplicate unique constraint violations on the second+ creation after restart.

Fix: Make `generateRef()` async and query `SELECT max(ref_col) FROM table` to
get the highest existing number, then increment.

Already implemented in quotations.ts → `generateRef()` is now async.

**Why:** Server restarts frequently in dev and occasionally in prod. Counters
must be DB-backed or use truly unique values (UUID, timestamp+random).

## Required foreign keys from req.body

Drizzle ORM treats `undefined` values as "use column default" during INSERT.
If a NOT NULL column has no DB default and `req.body.field` is `undefined`,
Drizzle silently omits it from the INSERT → DB throws NOT NULL constraint error.

Fix: Explicitly validate required FK fields before the insert:
```ts
if (!req.body.clientId) return res.status(400).json({ error: "clientId is required" });
```

Already implemented in visa.ts.

## Voucher creation format

POST /api/accounting/vouchers requires:
- `type`: "RV" | "PV" | "JV" | "CV" (not "receipt", "payment", etc.)
- `date`: date string
- `narration`: string (not "description")
- `lines[]`: array of ≥2 entries, each with `accountId`, `debitAmount`, `creditAmount`
- DR total must equal CR total (validated server-side)

This is NOT a simple debitAccountId/creditAccountId API.

## Portal auth

Portal user type: "party" | "dc" (not "customer", "individual", etc.)
Login field: `emailOrPhone` (not `email`)
New party accounts: status = "pending_approval" (must be approved by admin)
New DC accounts: status = "active" (instant activation)
Portal session token: different from ERP JWT — stored in DB column, passed as Bearer
