/**
 * Payment Reminder Automation
 * Detects overdue invoices at 1/2/7/14/30 day intervals and sends WhatsApp reminders.
 */
import { db, invoicesTable, clientsTable } from "@workspace/db";
import { eq, and, lt, isNotNull } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { runAutomation, logAutomationEvent, isDuplicateToday, getTemplate, type AutomationResult } from "../automation-engine.js";
import { sendWhatsAppMessageSafe } from "./wa-helper.js";

const TYPE = "payment_reminder";
const REMINDER_DAYS = [1, 2, 7, 14, 30];

const DEFAULT_TEMPLATE = `📋 *Payment Reminder*

Dear {clientName},

Your invoice *{invoiceNumber}* for *{currency} {amount}* was due on *{dueDate}*.

Please arrange payment at your earliest convenience.

Outstanding: *{currency} {outstanding}*

Thank you,
Al Musafir International`;

async function runPaymentReminders(): Promise<AutomationResult> {
  const result: AutomationResult = { sent: 0, skipped: 0, failed: 0, errors: [] };
  const template = await getTemplate("template_payment_reminder", DEFAULT_TEMPLATE);

  const now = new Date();

  for (const days of REMINDER_DAYS) {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    const nextCutoff = new Date(cutoff);
    nextCutoff.setDate(nextCutoff.getDate() + 1);

    const overdue = await db
      .select({
        id: invoicesTable.id,
        invoiceNumber: invoicesTable.invoiceNumber,
        amount: invoicesTable.amount,
        paidAmount: invoicesTable.paidAmount,
        currency: invoicesTable.currency,
        dueDate: invoicesTable.dueDate,
        clientId: invoicesTable.clientId,
        clientName: clientsTable.name,
        clientWhatsapp: clientsTable.whatsapp,
        clientPhone: clientsTable.phone,
      })
      .from(invoicesTable)
      .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
      .where(
        and(
          eq(invoicesTable.type, "customer"),
          eq(invoicesTable.status, "unpaid"),
          lt(invoicesTable.dueDate, nextCutoff),
          isNotNull(invoicesTable.dueDate),
        ),
      );

    for (const inv of overdue) {
      if (!inv.dueDate) continue;
      const dueMs = new Date(inv.dueDate).getTime();
      const diffDays = Math.round((now.getTime() - dueMs) / 86_400_000);
      if (!REMINDER_DAYS.includes(diffDays)) continue;

      const phone = inv.clientWhatsapp || inv.clientPhone || "";
      if (!phone) { result.skipped++; continue; }

      const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net";

      if (await isDuplicateToday(TYPE, inv.id, jid)) { result.skipped++; continue; }

      const outstanding = (Number(inv.amount) - Number(inv.paidAmount ?? 0)).toFixed(2);
      const msg = template
        .replace("{clientName}", inv.clientName ?? "Valued Customer")
        .replace("{invoiceNumber}", inv.invoiceNumber ?? `#${inv.id}`)
        .replace("{currency}", inv.currency ?? "PKR")
        .replace("{amount}", Number(inv.amount).toFixed(2))
        .replace("{dueDate}", new Date(inv.dueDate).toLocaleDateString())
        .replace("{outstanding}", outstanding)
        .replace("{days}", String(diffDays));

      const t0 = Date.now();
      const ok = await sendWhatsAppMessageSafe(jid, msg);
      const execTime = Date.now() - t0;

      await logAutomationEvent({
        automationType: TYPE,
        entityType: "invoice",
        entityId: inv.id,
        recipient: jid,
        messagePreview: msg.slice(0, 200),
        status: ok ? "sent" : "failed",
        errorMessage: ok ? undefined : "WhatsApp send failed",
        executionTime: execTime,
      });

      if (ok) result.sent++;
      else { result.failed++; result.errors.push(`Invoice ${inv.id}: send failed`); }
    }
  }

  return result;
}

export async function runPaymentReminderAutomation() {
  return runAutomation(TYPE, runPaymentReminders);
}
