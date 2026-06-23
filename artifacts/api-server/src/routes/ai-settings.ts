import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.get("/ai-settings/status", requireAuth, (_req, res) => {
  const configured = !!(process.env.OPENAI_API_KEY);
  res.json({
    configured,
    model: "gpt-4o-mini",
    ocrEnabled: configured,
  });
});

router.post("/ai-settings", requireAuth, requireRole("admin", "management"), async (req, res) => {
  try {
    const { openaiApiKey } = req.body;
    if (!openaiApiKey || typeof openaiApiKey !== "string") {
      return res.status(400).json({ error: "openaiApiKey is required" });
    }

    if (!openaiApiKey.startsWith("sk-")) {
      return res.status(400).json({ error: "Invalid API key format — should start with sk-" });
    }

    logger.info("AI Settings: OpenAI API key updated by admin");

    process.env.OPENAI_API_KEY = openaiApiKey;

    return res.json({
      ok: true,
      message: "API key saved for this session. To persist across restarts, add OPENAI_API_KEY as a Replit Secret.",
      persistenceNote: true,
    });
  } catch (err) {
    req.log.error({ err }, "AI settings update error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
