import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const router = Router();
const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
// dist/ -> api-server/ -> artifacts/ -> workspace root
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const PDF_PATH = path.join(WORKSPACE_ROOT, "scripts", "project-map.pdf");

router.get("/project-map/status", requireAuth, (_req, res) => {
  if (!fs.existsSync(PDF_PATH)) {
    return res.json({ exists: false, generatedAt: null, sizeBytes: 0 });
  }
  const stat = fs.statSync(PDF_PATH);
  return res.json({
    exists: true,
    generatedAt: stat.mtime.toISOString(),
    sizeBytes: stat.size,
  });
});

router.post("/project-map/regenerate", requireAuth, requireRole("admin", "management"), async (req, res) => {
  try {
    req.log.info("Starting project map PDF regeneration");
    await execFileAsync("pnpm", ["--filter", "@workspace/scripts", "run", "generate-map"], {
      cwd: WORKSPACE_ROOT,
      timeout: 90_000,
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    const stat = fs.existsSync(PDF_PATH) ? fs.statSync(PDF_PATH) : null;
    req.log.info({ sizeBytes: stat?.size }, "Project map PDF regenerated");
    return res.json({
      ok: true,
      downloadPath: "/api/project-map/download",
      generatedAt: stat ? stat.mtime.toISOString() : new Date().toISOString(),
      sizeBytes: stat?.size ?? 0,
      pages: 10,
      totalHours: 695,
    });
  } catch (err) {
    req.log.error({ err }, "Project map regeneration failed");
    return res.status(500).json({ error: "Regeneration failed. Check server logs." });
  }
});

router.get("/project-map/download", requireAuth, (req, res) => {
  if (!fs.existsSync(PDF_PATH)) {
    return res.status(404).json({ error: "PDF not found — click Regenerate to generate it first." });
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="al-musafir-project-map.pdf"');
  return fs.createReadStream(PDF_PATH).pipe(res);
});

export default router;
