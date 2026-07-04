/**
 * Visa Expiry Alert Automation
 * Weekly: find visas expiring in 30/15/7 days, notify client.
 */
import { db, visaApplicationsTable, clientsTable } from "@workspace/db";
import { eq, isNotNull } from "drizzle-orm";
import { runAutomation, logAutomationEvent, isDuplicateToday, getTemplate, type AutomationResult } from "../automation-engine.js";
import { sendWhatsAppMessageSafe } from "./wa-helper.js";

const TYPE = "visa_expiry";
const ALERT_DAYS = [30, 15, 7];

const DEFAULT_TEMPLATE = `🛂 *Visa Expiry Notice*

Dear {clientName},

Your visa is expiring soon:

📘 Passport: *{passportNumber}*
📅 Visa Expiry: *{approvedAt}*
⚠️ Days Remaining: *{daysLeft}*

Please take necessary action before expiry.

Al Musafir International`;

async function runVisaExpiry(): Promise<AutomationResult> {
  const result: AutomationResult = { sent: 0, skipped: 0, failed: 0, errors: [] };
  const template = await getTemplate("template_visa_reminder", DEFAULT_TEMPLATE);

  const now = new Date();

  for (const days of ALERT_DAYS) {
    const target = new Date(now);
    target.setDate(target.getDate() + days);
    const dayBefore = new Date(target);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayAfter = new Date(target);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const visas = await db
      .select({
        id: visaApplicationsTable.id,
        clientId: visaApplicationsTable.clientId,
        passportNumber: visaApplicationsTable.passportNumber,
        passportExpiry: visaApplicationsTable.passportExpiry,
        approvedAt: visaApplicationsTable.approvedAt,
        clientName: clientsTable.name,
        clientWhatsapp: clientsTable.whatsapp,
        clientPhone: clientsTable.phone,
      })
      .from(visaApplicationsTable)
      .leftJoin(clientsTable, eq(visaApplicationsTable.clientId, clientsTable.id))
      .where(isNotNull(visaApplicationsTable.passportExpiry));

    const matching = visas.filter((v) => {
      if (!v.passportExpiry) return false;
      const exp = new Date(v.passportExpiry);
      return exp >= dayBefore && exp < dayAfter;
    });

    for (const visa of matching) {
      const phone = visa.clientWhatsapp || visa.clientPhone || "";
      if (!phone) { result.skipped++; continue; }

      const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net";
      if (await isDuplicateToday(TYPE, visa.id, jid)) { result.skipped++; continue; }

      const expDate = new Date(visa.passportExpiry!);
      const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / 86_400_000);

      const msg = template
        .replace("{clientName}", visa.clientName ?? "Client")
        .replace("{passportNumber}", visa.passportNumber ?? "")
        .replace("{approvedAt}", visa.approvedAt ? new Date(visa.approvedAt).toLocaleDateString() : "")
        .replace("{daysLeft}", String(daysLeft));

      const t0 = Date.now();
      const ok = await sendWhatsAppMessageSafe(jid, msg);

      await logAutomationEvent({
        automationType: TYPE,
        entityType: "visa",
        entityId: visa.id,
        recipient: jid,
        messagePreview: msg.slice(0, 200),
        status: ok ? "sent" : "failed",
        errorMessage: ok ? undefined : "WhatsApp send failed",
        executionTime: Date.now() - t0,
      });

      if (ok) result.sent++;
      else { result.failed++; result.errors.push(`Visa ${visa.id}: send failed`); }
    }
  }

  return result;
}

export async function runVisaExpiryAutomation() {
  return runAutomation(TYPE, runVisaExpiry);
}
