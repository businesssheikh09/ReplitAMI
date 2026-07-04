# Al Musafir International — Travel Agency ERP

Al Musafir International is a full-stack ERP system for a Umrah travel agency. It manages the complete lifecycle of travel operations: customer enquiries, flight search and ticketing, hotel procurement, visa tracking, transport, accounting, WhatsApp communications, customer portal, and automated notifications.

---

## Products

| Artifact | Kind | Base Path | Purpose |
|---|---|---|---|
| `artifacts/api-server` | API | `/api` | Express 5 REST API — the single backend for all products |
| `artifacts/umrah-erp` | Web | `/erp` | Staff ERP — all internal operations |
| `artifacts/frontend` | Web | `/` | Public website — packages, flights, customer portal |
| `artifacts/mockup-sandbox` | Design | `/preview` | UI mockup / canvas preview environment |

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Push DB schema (dev only)
pnpm --filter @workspace/db run push

# Start all services via Replit workflows, or individually:
pnpm --filter @workspace/api-server run dev      # API on PORT env var (default 8080)
pnpm --filter @workspace/umrah-erp run dev       # ERP on PORT env var
pnpm --filter @workspace/frontend run dev        # Public site on PORT env var
```

## Required Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret for session tokens |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | GCS bucket for file storage |
| `PRIVATE_OBJECT_DIR` | Path prefix for private uploads |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Comma-separated public storage search paths |

Optional (features degrade gracefully without them):
- `AI_INTEGRATIONS_OPENAI_API_KEY` — enables AI OCR (GPT-4o-mini)

---

## Workspace Structure

```
.
├── artifacts/
│   ├── api-server/          Express 5 API
│   ├── frontend/            Public React website
│   ├── umrah-erp/           Staff ERP React app
│   └── mockup-sandbox/      UI design sandbox
├── lib/
│   ├── db/                  Drizzle ORM schema + migrations
│   ├── api-spec/            OpenAPI 3.0 specification + orval config
│   ├── api-zod/             Generated Zod schemas
│   └── api-client-react/    Generated React Query hooks
├── scripts/
│   ├── post-merge.sh        Runs pnpm install + db push after merges
│   └── src/hello.ts         Example script
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── tsconfig.json
```

---

## Key Commands

```bash
pnpm run typecheck                              # Full typecheck (libs + all artifacts)
pnpm run build                                  # Typecheck + build all packages
pnpm --filter @workspace/api-spec run codegen  # Regenerate API hooks + Zod schemas
pnpm --filter @workspace/db run push           # Sync DB schema (dev only)
pnpm --filter @workspace/db run generate       # Create new migration file
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24, TypeScript 5.9 |
| API | Express 5, Pino logging |
| Database | PostgreSQL 16, Drizzle ORM, drizzle-zod |
| Validation | Zod v4 |
| API Codegen | Orval (OpenAPI → React Query + Zod) |
| Frontend | React 19, Vite 7, Wouter, TanStack Query |
| UI | Radix UI, Tailwind CSS, Lucide icons |
| WhatsApp | @whiskeysockets/baileys |
| Flight GDS | Amadeus, Sabre, Galileo (Travelport) |
| OCR | Tesseract.js (local), GPT-4o-mini (AI) |
| Storage | Google Cloud Storage (via Replit sidecar) |
| Build | esbuild (API), Vite (frontends) |
| Package Mgr | pnpm workspaces |

---

## Documentation Index

| File | Contents |
|---|---|
| [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) | Architecture overview, service topology, request flow |
| [DATABASE.md](DATABASE.md) | All tables, columns, constraints, relations, migrations |
| [API_REFERENCE.md](API_REFERENCE.md) | Every HTTP endpoint with method, path, auth, and description |
| [ERP_MODULES.md](ERP_MODULES.md) | ERP pages, sidebar structure, RBAC |
| [FRONTEND_MODULES.md](FRONTEND_MODULES.md) | Public website pages and components |
| [PORTAL_MODULES.md](PORTAL_MODULES.md) | Customer portal — pages, auth, data isolation |
| [ACCOUNTING.md](ACCOUNTING.md) | Double-entry ledger, vouchers, COA, financial years |
| [FLIGHTS.md](FLIGHTS.md) | GDS search, group tickets, booking lifecycle, refunds |
| [HOTELS.md](HOTELS.md) | Hotel procurement, vendor quotes, invoices |
| [WHATSAPP.md](WHATSAPP.md) | Baileys integration, inbox, bot campaigns |
| [AUTOMATION.md](AUTOMATION.md) | Automation engine, scheduler, all automation types |
| [OCR.md](OCR.md) | Document scanning, Tesseract, GPT-4o-mini, verification |
| [PERMISSIONS.md](PERMISSIONS.md) | Roles, RBAC map, action-level permissions |
| [REPORTS.md](REPORTS.md) | All reports: BSP, trial balance, P&L, party statement |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Replit deployment, env vars, post-merge script |
| [CHANGELOG.md](CHANGELOG.md) | Phase-by-phase build history |
