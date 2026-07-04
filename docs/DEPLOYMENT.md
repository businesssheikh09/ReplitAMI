# Deployment

**Hosting platform**: Replit (autoscale deployment)  
**Runtime**: Node.js 24, PostgreSQL 16  
**Artifact config**: `artifacts/api-server/.replit-artifact/artifact.toml`  
**Global config**: `.replit`  
**Post-merge script**: `scripts/post-merge.sh`  

---

## Environment Architecture

### Development
All services run as Replit **workflows** in the development environment:
- Each workflow binds a shell command to a long-running process
- The shared Replit reverse proxy routes `/api/*`, `/erp/*`, `/` to the appropriate service port
- Services read `PORT` from the environment variable assigned per workflow

### Production (Published)
- The API server runs as an autoscale deployment: `node artifacts/api-server/dist/index.mjs`
- Frontend artifacts are served as static files after `vite build`
- Published app is accessible at `.replit.app` domain (or custom domain if configured)
- Environment variables / secrets must be configured in the Replit Secrets panel

---

## Workflows (Development)

| Workflow | Command | Description |
|---|---|---|
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` | Builds + starts Express 5 API |
| `artifacts/frontend: web` | `pnpm --filter @workspace/frontend run dev` | Vite dev server for public site |
| `artifacts/umrah-erp: web` | `pnpm --filter @workspace/umrah-erp run dev` | Vite dev server for ERP |
| `artifacts/mockup-sandbox: Component Preview Server` | `pnpm --filter @workspace/mockup-sandbox run dev` | UI mockup dev server |

---

## Environment Variables & Secrets

All secrets are managed via Replit's Secrets panel (never committed to source). Reference them in code via `process.env.*`.

### Required

| Variable | Description | Where used |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Drizzle ORM, all DB queries |
| `SESSION_SECRET` | Secret for session token signing | Auth middleware |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | GCS bucket name | `objectStorage.ts` |
| `PRIVATE_OBJECT_DIR` | Path prefix for private uploads | `objectStorage.ts` |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Comma-separated public path prefixes | `objectStorage.ts` |

### Optional (features degrade gracefully without them)

| Variable | Description | Effect if missing |
|---|---|---|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API key for GPT-4o-mini OCR | AI OCR unavailable; falls back to local Tesseract |

### Set Via ERP Settings Page (Session-Only)

These are set through the ERP UI and stored in `process.env` for the current process:
- OpenAI API key (ERP → AI Settings → `POST /api/ai-settings`)
- Note: these do NOT persist across server restarts — use Replit Secrets for persistence

---

## Production Run Command

The API server artifact is configured to run:
```bash
node artifacts/api-server/dist/index.mjs
```

This executes the pre-built esbuild bundle. The bundle is created during the build step.

### API Server Build (`build.mjs`)
Uses `esbuild` to bundle the entire Express app:
- **Format**: ESM bundle (`dist/index.mjs`)
- **Source maps**: emitted alongside (`dist/index.mjs.map`)
- **Externals**: large native modules excluded from bundle:
  - `@whiskeysockets/baileys` (WhatsApp)
  - `sharp`, `canvas`, `sqlite3`
  - All standard Node.js built-ins
  - Pino worker scripts are copied separately
- **Output**: `dist/` directory (~4MB bundle)

### Frontend Build
Both `artifacts/frontend` and `artifacts/umrah-erp` use:
```bash
vite build
```
Output: `dist/public/` — static HTML/JS/CSS files.

---

## Database Setup

### Development
```bash
# Push schema changes directly (no migration file generated)
pnpm --filter @workspace/db run push
```

### Production
Production database schema is managed via Drizzle migrations:
```bash
# Generate migration SQL from schema changes
pnpm --filter @workspace/db run generate

# Apply migrations to production database
# (run via database skill or production access)
```

Production DB schema sync after a task merge:
```bash
scripts/post-merge.sh
```
This script runs: `pnpm install && pnpm --filter @workspace/db run push`

---

## Post-Merge Script

`scripts/post-merge.sh` runs automatically after a task agent's code is merged:

```bash
#!/bin/bash
set -e
pnpm install                         # Ensure all dependencies are installed
pnpm --filter @workspace/db run push # Apply any schema changes
```

This ensures:
- New packages from merged branches are installed
- Database schema is kept up to date with the code

---

## Artifact Configuration

`artifacts/api-server/.replit-artifact/artifact.toml`:
```toml
[[services]]
localPort = 8080
name = "API Server"
paths = ["/api"]
```

This tells the Replit reverse proxy to route `/api/*` requests to port 8080.

### `.replit` (Root)
```toml
modules = ["nodejs-24", "postgresql-16"]
deploymentTarget = "autoscale"
```

- **modules**: NixOS packages installed in the container
- **deploymentTarget**: `autoscale` — Replit manages horizontal scaling

### `.replitignore`
```
.local
```
Excludes the `.local/` directory (agent skills, state, task files) from the deployment image to reduce image size.

---

## Build & Typecheck

Full build (typecheck + compile everything):
```bash
pnpm run build
```

This runs:
1. `pnpm run typecheck` — `tsc --build` for libs + `tsc --noEmit` for all artifacts
2. `pnpm -r --if-present run build` — esbuild for API, vite build for frontends

**Note**: Do not run `pnpm run dev` at workspace root — there is no root dev script. Individual services must be started via their workflows.

---

## Codegen (After API Spec Changes)

When `lib/api-spec/openapi.yaml` is updated, regenerate client code:
```bash
pnpm --filter @workspace/api-spec run codegen
```

This runs Orval and outputs to:
- `lib/api-client-react/src/generated/` — React Query hooks
- `lib/api-zod/src/generated/` — Zod schemas + TypeScript types

---

## Object Storage (GCS)

The system uses Google Cloud Storage via a **Replit-managed sidecar** at `http://127.0.0.1:1106`.

### Sidecar API
| Call | Purpose |
|---|---|
| `POST http://127.0.0.1:1106/token` | Get GCS access token |
| `POST http://127.0.0.1:1106/sign` | Get presigned URL for upload or download |

### ACL Modes
- **Public objects**: stored under paths in `PUBLIC_OBJECT_SEARCH_PATHS`; accessible via `GET /api/storage/public-objects/*`
- **Private objects**: stored under `PRIVATE_OBJECT_DIR`; require auth; served via `GET /api/storage/objects/*`

### Upload Flow
1. Client requests presigned URL: `POST /api/storage/uploads/request-url`
2. Client PUTs file directly to the presigned URL (GCS)
3. Client submits the `objectPath` to the relevant ERP endpoint

---

## WhatsApp Session in Production

The WhatsApp session persists in `artifacts/api-server/whatsapp-session/`. This directory:
- Contains QR auth credentials and encryption keys
- Must persist across deployments; Replit autoscale keeps the filesystem between deploys
- If the session is cleared, staff must re-scan the QR code

**Note**: `whatsapp-session/` files are committed to the repository (the identity key files are not secret — they are WhatsApp's public key material). The `creds.json` file contains sensitive auth credentials and should ideally be excluded from version control in a production hardening pass.

---

## Logs

**Development**: Pino logs to stdout with pretty-printing. View in workflow console.

**Production**: Pino logs to stdout in JSON format. View via Replit deployment logs panel.

```bash
# Fetch deployment logs (via Replit tools)
# Or use the fetch_deployment_logs tool in the agent
```

### Log Levels
- `INFO` — Normal request completion, scheduled service events
- `WARN` — Baileys WhatsApp warnings, non-critical issues
- `ERROR` — Route handler errors, database failures

### Redacted Fields
Authorization header and Cookie header values are redacted in all log output.

---

## Monitoring

### Health Check
`GET /api/healthz` — returns `{ status: "ok" }` with HTTP 200.  
Used by Replit's deployment health check probes.

### Dashboard Indicators
The ERP Dashboard shows:
- API server health (implicit — page loads = healthy)
- WhatsApp connection status
- Automation engine last-run status
- Inventory sweep last-run status

---

## Known Limitations

- `whatsapp-session/creds.json` contains sensitive authentication material but is committed to the repository — this should be added to `.gitignore` and managed as a secret for production.
- The Replit GCS sidecar (`127.0.0.1:1106`) is environment-specific; self-hosting requires replacing `objectStorage.ts` with a standard GCS client library.
- The OpenAI API key set via the ERP UI is stored in `process.env` and does not survive server restarts. Use Replit Secrets for persistence.
- Autoscale deployment may spin up multiple instances; the in-memory automation concurrency lock (`Set<string>` in `automation-engine.ts`) is not shared across instances, potentially allowing duplicate automation runs in a multi-instance scenario.
- esbuild bundle size is ~4.1MB; large due to Drizzle ORM and other dependencies being inlined.

---

## Future Extension Points

- Containerise with Docker for portable self-hosting
- Move WhatsApp session to persistent external storage (Redis / S3)
- Redis-backed automation lock for multi-instance deployments
- GitHub Actions CI/CD pipeline for automated testing + deployment
- Separate staging environment for testing before production promotion
- Structured secrets rotation process
