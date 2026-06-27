# AI Working Rules

Rules every AI agent must follow when working on this codebase. Violating these causes build failures, runtime errors, or hard-to-diagnose bugs.

---

## API Contract — Always OpenAPI First

1. **Inspect the OpenAPI spec before adding or modifying routes.**  
   File: `lib/api-spec/openapi.yaml`  
   The spec is the contract. The server implements it; the clients consume generated code from it.

2. **Run codegen after any spec change.**
   ```
   pnpm --filter @workspace/api-spec run codegen
   ```
   This regenerates `@workspace/api-client-react` (React Query hooks) and `@workspace/api-zod` (Zod schemas). Forgetting this leaves clients out of sync.

---

## Database — Schema & Migrations

3. **Run DB push after any schema change (dev only).**
   ```
   pnpm --filter @workspace/db run push
   ```
   Do **not** use `drizzle-kit migrate` in development — `push` is the dev workflow. Migrations are for production only.

4. **No DB-level FK enforcement.**  
   Drizzle schema files declare integer references by naming convention (`clientId → clients.id`) but the database does NOT enforce foreign keys. Do not assume cascade deletes or referential integrity will be enforced by Postgres.

---

## Logging — Never `console.log` in Server Code

5. **In route handlers**, use `req.log` (Pino instance injected by middleware).  
   **Outside request context** (startup, workers, scheduled jobs), use the singleton `logger` from the logging module.  
   `console.log` is forbidden in server code — it bypasses structured logging and pollutes test output.

---

## Imports — esbuild Gotchas

6. **Always use `.js` extensions on relative imports in the API server.**
   ```ts
   import { db } from "./db.js";      // correct
   import { db } from "./db";         // WRONG — esbuild CJS bundle fails
   ```

7. **Never import `zod/v4` directly in files bundled by esbuild.**  
   Use the re-export from `@workspace/db` instead:
   ```ts
   import { z } from "@workspace/db"; // correct
   import { z } from "zod/v4";        // WRONG in bundled files
   ```
   Background: esbuild does not bundle `zod/v4` as a sub-path, causing runtime module-not-found errors.

---

## Workspace Commands — What NOT to Do

8. **Do not run `pnpm dev` or `pnpm run dev` at the workspace root.**  
   There is no root-level `dev` script. Individual artifacts run via Replit workflows, which inject the correct `PORT` and `BASE_PATH` env vars. Running dev from the shell won't wire these up correctly.

9. **Do not add leaf packages to the root `tsconfig.json` references.**  
   `tsconfig.json` at the root is a solution file for buildable libs (`lib/*`) only. Artifacts (`artifacts/*`) are leaf packages — do not add them there. Doing so causes TS2742 type portability errors.

10. **Verify artifacts with `typecheck`, not `build`.**
    ```
    pnpm --filter @workspace/frontend run typecheck   # correct
    pnpm --filter @workspace/frontend run build       # WRONG from bash — needs PORT + BASE_PATH
    ```

---

## Zod Version

11. **This project uses `zod/v4` (Zod 4).** The import path is `"zod/v4"`, not `"zod"`. This matters most in lib packages. See rule 7 for the esbuild exception.

---

## OpenAPI `info.title` — Do Not Change

12. **Do not change the `info.title` field in `openapi.yaml`.**  
    Orval derives generated filenames from it. Changing it renames all generated files and breaks every import across `@workspace/api-client-react` and `@workspace/api-zod`.

---

## Summary Checklist Before Submitting

- [ ] Spec updated before adding routes
- [ ] `pnpm --filter @workspace/api-spec run codegen` run after spec changes
- [ ] `pnpm --filter @workspace/db run push` run after schema changes
- [ ] No `console.log` in server files
- [ ] Relative imports in API server use `.js` extensions
- [ ] No `zod/v4` direct imports in esbuild-bundled files
- [ ] No leaf packages added to root `tsconfig.json`
