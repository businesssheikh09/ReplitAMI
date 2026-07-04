/**
 * Passport Expiry Alert Automation
 * Weekly: find passports expiring in 90/60/30 days, notify assigned salesperson.
 */
import { db, passengerDocumentsTable, usersTable } from "@workspace/db";
import { eq, and, lte, gte, isNotNull } from "drizzle-orm";
import { runAutomation, logAutomationEvent, isDuplicateToday, getTemplate, type AutomationResult } from "../automation-engine.js";
import { sendWhatsAppMessageSafe } from "./wa-helper.js";

const TYPE = "passport_expiry";
const ALERT_DAYS = [90, 60, 30];

const DEFAULT_TEMPLATE = `📘 *Passport Expiry Alert*

Dear {staffName},

The following passport is expiring soon:

👤 Passenger: *{passengerName}*
📘 Passport: *{passportNumber}*
📅 Expiry: *{passportExpiry}*
⚠️ Days Remaining: *{daysLeft}*

Please advise the client to renew their passport immediately.

Al Musafir International`;

async function runPassportExpiry(): Promise<AutomationResult> {
  const result: AutomationResult = { sent: 0, skipped: 0, failed: 0, errors: [] };
  const template = await getTemplate("template_passport_reminder", DEFAULT_TEMPLATE);

  const now = new Date();

  for (const days of ALERT_DAYS) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + days);
    const targetStr = targetDate.toISOString().slice(0, 10);
    const dayBefore = new Date(targetDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayAfter = new Date(targetDate);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const docs = await db
      .select({
        id: passengerDocumentsTable.id,
        passengerName: passengerDocumentsTable.passengerName,
        passportNumber: passengerDocumentsTable.passportNumber,
        passportExpiry: passengerDocumentsTable.passportExpiry,
        verifiedBy: passengerDocumentsTable.verifiedBy,
        staffPhone: usersTable.phone,
        staffName: usersTable.name,
      })
      .from(passengerDocumentsTable)
      .leftJoin(usersTable, eq(passengerDocumentsTable.verifiedBy, usersTable.id))
      .where(isNotNull(passengerDocumentsTable.passportExpiry));

    const matching = docs.filter((d) => {
      if (!d.passportExpiry) return false;
      const exp = new Date(d.passportExpiry);
      return exp >= dayBefore && exp < dayAfter;
    });

    for (const doc of matching) {
      if (!doc.staffPhone) { result.skipped++; continue; }

      const jid = doc.staffPhone.replace(/\D/g, "") + "@s.whatsapp.net";
      if (await isDuplicateToday(TYPE, doc.id, jid)) { result.skipped++; continue; }

      const expDate = new Date(doc.passportExpiry!);
      const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / 86_400_000);

      const msg = template
        .replace("{staffName}", doc.staffName ?? "Staff")
        .replace("{passengerName}", doc.passengerName ?? "Passenger")
        .replace("{passportNumber}", doc.passportNumber ?? "")
        .replace("{passportExpiry}", String(doc.passportExpiry))
        .replace("{daysLeft}", String(daysLeft));

      const t0 = Date.now();
      const ok = await sendWhatsAppMessageSafe(jid, msg);

      await logAutomationEvent({
        automationType: TYPE,
        entityType: "passport",
        entityId: doc.id,
        recipient: jid,
        messagePreview: msg.slice(0, 200),
        status: ok ? "sent" : "failed",
        errorMessage: ok ? undefined : "WhatsApp send failed",
        executionTime: Date.now() - t0,
      });

      if (ok) result.sent++;
      else { result.failed++; result.errors.push(`Passport ${doc.id}: send failed`); }
    }
  }

  return result;
}

export async function runPassportExpiryAutomation() {
  return runAutomation(TYPE, runPassportExpiry);
}
