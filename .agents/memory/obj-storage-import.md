---
name: Object Storage Import Fix
description: esbuild bundling rules for api-server storage files
---

When copying object storage template files into api-server/src:
1. All relative imports must use `.js` extension (ESM + esbuild requirement): `from "./objectAcl.js"` not `from "./objectAcl"`
2. Do NOT import `zod/v4` in any api-server source file — esbuild does not bundle it as external and will fail. Use plain JS validation instead.
3. Do NOT import workspace types (e.g. `RequestUploadUrlBody` from `@workspace/api-zod`) that don't yet exist in the generated files.

**Why:** The api-server build uses esbuild with ESM output. Missing `.js` extensions break module resolution. `zod/v4` is a subpath export that esbuild cannot resolve without special config.

**How to apply:** Any time you copy/write files in `artifacts/api-server/src/`, check all relative imports have `.js` extension and avoid `zod/v4` imports.
