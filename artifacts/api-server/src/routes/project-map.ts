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
    const { stdout } = await execFileAsync("pnpm", ["--filter", "@workspace/scripts", "run", "generate-map"], {
      cwd: WORKSPACE_ROOT,
      timeout: 90_000,
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    // Parse actual hours from script output:
    // "Total time: 1983 min (33.0h)  |  Cost @ $5/hr: $165.25"
    let totalMinutes = 0;
    let totalHours   = 0;
    let costUSD      = 0;
    const timeMatch = stdout.match(/Total time:\s*(\d+)\s*min\s*\(([0-9.]+)h\)/);
    const costMatch = stdout.match(/Cost @ \$[\d.]+\/hr:\s*\$([0-9.]+)/);
    if (timeMatch) { totalMinutes = parseInt(timeMatch[1], 10); totalHours = parseFloat(timeMatch[2]); }
    if (costMatch) { costUSD = parseFloat(costMatch[1]); }

    const stat = fs.existsSync(PDF_PATH) ? fs.statSync(PDF_PATH) : null;
    req.log.info({ sizeBytes: stat?.size, totalMinutes, totalHours }, "Project map PDF regenerated");
    return res.json({
      ok: true,
      downloadPath: "/api/project-map/download",
      generatedAt: stat ? stat.mtime.toISOString() : new Date().toISOString(),
      sizeBytes: stat?.size ?? 0,
      pages: 10,
      totalMinutes,
      totalHours,
      costUSD,
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
