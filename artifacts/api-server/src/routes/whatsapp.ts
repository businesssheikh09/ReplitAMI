import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  getConnectionStatus,
  getQRCode,
  disconnectWhatsApp,
} from "../services/whatsapp.js";

const router = Router();
const canManage = requireRole("admin", "management");

/**
 * GET /api/whatsapp/status
 * Returns the current WhatsApp connection status.
 */
router.get("/whatsapp/status", requireAuth, canManage, (_req, res) => {
  const status = getConnectionStatus();
  return res.json({
    status,
    connected: status === "connected",
    connecting: status === "connecting",
  });
});

/**
 * GET /api/whatsapp/qr
 * Returns the latest QR code string (if available) for scanning.
 * Returns 404 when no QR is pending (already connected or not initialised yet).
 */
router.get("/whatsapp/qr", requireAuth, canManage, (_req, res) => {
  const qr = getQRCode();
  if (!qr) return res.status(404).json({ error: "No QR code available" });
  return res.json({ qr });
});

/**
 * POST /api/whatsapp/disconnect
 * Logs out the active WhatsApp session and clears the session directory.
 */
router.post("/whatsapp/disconnect", requireAuth, canManage, async (req, res) => {
  try {
    await disconnectWhatsApp();
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "WhatsApp disconnect failed");
    const msg = err instanceof Error ? err.message : "Disconnect failed";
    return res.status(500).json({ error: msg });
  }
});

export default router;
