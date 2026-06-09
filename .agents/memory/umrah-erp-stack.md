---
name: Umrah ERP stack
description: Core architecture decisions for the Umrah Travel ERP project
---

All 12 modules implemented: Dashboard, CRM (clients + follow-ups), Quotations, Hotel Requests, Hotels DB, Vendors, Transport, Flights, Visa, Accounting (invoices + expenses), Users, Documents.

**Why:** API-first contract (OpenAPI → Orval codegen) keeps frontend hooks auto-generated; Drizzle ORM keeps schema and types in sync.

**How to apply:** Always run `pnpm --filter @workspace/api-spec run codegen` after OpenAPI changes. Run `pnpm --filter @workspace/db run push` after schema changes.

Key data conventions:
- Vendor quote prices stored as integers (cents × 100) in DB, divided on read
- Quotation totals auto-recalculated on item add/update/delete
- All money fields use `numeric(12,2)` in DB, returned as `parseFloat` in routes
- Activity logs table (`activity_logs`) for dashboard feed — insert manually in routes on key events
