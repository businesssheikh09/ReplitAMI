import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.get("/ai-settings/status", requireAuth, (_req, res) => {
  const configured = !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
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

    // Validate format
    if (!openaiApiKey.startsWith("sk-")) {
      return res.status(400).json({ error: "Invalid API key format — should start with sk-" });
    }

    logger.info("AI Settings: OpenAI API key updated by admin");

    // Note: In production, this would write to .env or a secrets store.
    // For now, we store it in the process environment for the runtime session.
    // The user must also set AI_INTEGRATIONS_OPENAI_API_KEY and AI_INTEGRATIONS_OPENAI_BASE_URL
    // as Replit secrets for persistence across restarts.
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = openaiApiKey;
    if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
      process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "https://api.openai.com/v1";
    }

    return res.json({
      ok: true,
      message: "API key saved for this session. To persist across restarts, add AI_INTEGRATIONS_OPENAI_API_KEY and AI_INTEGRATIONS_OPENAI_BASE_URL as Replit Secrets.",
      persistenceNote: true,
    });
  } catch (err) {
    req.log.error({ err }, "AI settings update error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
