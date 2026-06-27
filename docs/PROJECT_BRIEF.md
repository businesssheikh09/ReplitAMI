# Project Brief — Umrah Travel Agency Platform

## What This Is

A full-stack SaaS platform for an Umrah travel agency. It consists of:

1. **A public-facing website** — lets visitors browse packages, search flights, submit booking inquiries, and register as portal users.
2. **An internal ERP** — used by agency staff to manage clients, quotations, flights, hotels, transport, visas, accounting, WhatsApp messaging, and more.
3. **A REST API server** — serves both the public website and the ERP; all business logic lives here.

---

## Artifacts

| Artifact | Kind | Directory | Preview Path |
|---|---|---|---|
| Public Website | web | `artifacts/frontend` | `/frontend/` |
| Umrah Travel ERP | web | `artifacts/umrah-erp` | `/` |
| API Server | api | `artifacts/api-server` | `/api` |
| Canvas (design sandbox) | design | `artifacts/mockup-sandbox` | `/__mockup` |

---

## Shared Libraries (`lib/`)

| Package | Purpose |
|---|---|
| `@workspace/db` | Drizzle ORM schema, migrations, DB connection — single source of truth for all tables |
| `@workspace/api-spec` | OpenAPI 3.0 spec (`openapi.yaml`); run `pnpm --filter @workspace/api-spec run codegen` to regenerate clients |
| `@workspace/api-client-react` | React Query hooks generated from the OpenAPI spec (used by ERP and frontend) |
| `@workspace/api-zod` | Zod schemas generated from the OpenAPI spec (used for runtime validation) |

---

## Module Inventory

| Module | Description |
|---|---|
| **Auth / Staff** | ERP login, role-based access control (management / sales / accounts / operations), ticket-issuance PIN |
| **CRM** | Clients, client notes, follow-ups, lead pipeline |
| **Quotations** | Sales quotations with line items; linked to clients; status workflow |
| **Hotels** | Hotel catalogue, vendors, hotel requests, vendor quotes |
| **Hotel Invoices** | DN-numbered hotel invoices with SAR/PKR dual-currency billing |
| **Transport** | Ground transport bookings linked to clients and vendors |
| **Visa** | Visa application tracking per client |
| **Flights — Quotations** | ERP-created flight quotations with ticket issuance (PIN-gated) |
| **Flights — Requests** | Public/portal flight requests → ERP review → issue; dual-rate fare logic |
| **Group Tickets** | Bulk group-seat inventory scraped from WhatsApp messages; public booking flow |
| **GDS Settings** | Amadeus / Sabre / Galileo adapter credentials; mock fallback when unconfigured |
| **Portal Users** | Public user registration (party / vendor / dc types); approval workflow; session tokens |
| **Booking Inquiries** | Group ticket booking submissions from public website or portal; payment receipt upload |
| **Package Inquiries** | Umrah package inquiries from public website; linked to hotels and quotations |
| **Accounting** | Double-entry journal, chart of accounts, invoices, payments, expenses, documents |
| **Currency** | Multi-currency settings, daily rates (vendor/guest/client), profit tracking; live forex.pk scraper |
| **WhatsApp** | Baileys-based connection, group monitoring, inbox, reply threads, entity linking |
| **Bot / Campaigns** | WhatsApp blast campaigns to contact lists; per-message delay control |
| **Website Config** | Key-value store for public website settings (managed from ERP) |
| **AI Settings** | OpenAI Vision key management; used for passport/document OCR |
| **Object Storage** | Replit Object Storage for passport and document file uploads |

---

## Tech Stack

- **Runtime**: Node.js 24, TypeScript 5.9
- **Monorepo**: pnpm workspaces
- **API**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (no DB-level FK enforcement — Drizzle convention only)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (OpenAPI → React Query hooks + Zod schemas)
- **Build**: esbuild (CJS bundle for API server)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **WhatsApp**: Baileys (multi-device)
