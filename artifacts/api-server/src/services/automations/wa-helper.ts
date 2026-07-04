/**
 * Safe WhatsApp send wrapper — returns true/false instead of throwing.
 * Used by all automation runners.
 */
import { logger } from "../../lib/logger.js";

export async function sendWhatsAppMessageSafe(jid: string, text: string): Promise<boolean> {
  try {
    const { sendWhatsAppMessage } = await import("../whatsapp.js");
    await sendWhatsAppMessage(jid, text, null, null);
    return true;
  } catch (err) {
    logger.warn({ err, jid }, "Automation WhatsApp send failed");
    return false;
  }
}
