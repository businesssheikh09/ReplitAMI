/**
 * Pending Approval Alerts Automation
 * Every 2 hours: notify management of items awaiting approval.
 */
import { db, vouchersTable, invoicesTable, hotelInvoicesTable, flightRequestsTable, websiteConfigTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { runAutomation, logAutomationEvent, getTemplate, type AutomationResult } from "../automation-engine.js";
import { sendWhatsAppMessageSafe } from "./wa-helper.js";

const TYPE = "pending_approvals";

const DEFAULT_TEMPLATE = `⚠️ *Pending Approvals Alert*

The following items require your attention:

📄 Draft Vouchers: *{draftVouchers}*
💼 Pending Invoices: *{pendingInvoices}*
🏨 Hotel Drafts: *{hotelDrafts}*
✈️ Flight Requests: *{flightRequests}*

Please log in to the ERP to review and approve.

Al Musafir International`;

async function runPendingApprovals(): Promise<AutomationResult> {
  const result: AutomationResult = { sent: 0, skipped: 0, failed: 0, errors: [] };
  const template = await getTemplate("template_pending_approvals", DEFAULT_TEMPLATE);

  const [draftVouchers] = await db.select({ c: count() }).from(vouchersTable).where(eq(vouchersTable.status, "draft"));
  const [pendingInvoices] = await db.select({ c: count() }).from(invoicesTable).where(eq(invoicesTable.status, "unpaid"));
  const [hotelDrafts] = await db.select({ c: count() }).from(hotelInvoicesTable).where(eq(hotelInvoicesTable.status, "draft"));
  const [flightRequests] = await db.select({ c: count() }).from(flightRequestsTable).where(eq(flightRequestsTable.status, "pending"));

  const total = Number(draftVouchers?.c ?? 0) + Number(pendingInvoices?.c ?? 0) +
                Number(hotelDrafts?.c ?? 0) + Number(flightRequests?.c ?? 0);

  if (total === 0) { result.skipped++; return result; }

  const configRows = await db.select().from(websiteConfigTable);
  const configMap: Record<string, string> = {};
  for (const r of configRows) configMap[r.key] = r.value;
  const mgmtPhone = configMap["company_whatsapp"] || configMap["contact_whatsapp"] || "";

  if (!mgmtPhone) { result.skipped++; result.errors.push("No management WhatsApp configured"); return result; }

  const jid = mgmtPhone.replace(/\D/g, "") + "@s.whatsapp.net";

  const msg = template
    .replace("{draftVouchers}", String(draftVouchers?.c ?? 0))
    .replace("{pendingInvoices}", String(pendingInvoices?.c ?? 0))
    .replace("{hotelDrafts}", String(hotelDrafts?.c ?? 0))
    .replace("{flightRequests}", String(flightRequests?.c ?? 0));

  const t0 = Date.now();
  const ok = await sendWhatsAppMessageSafe(jid, msg);

  await logAutomationEvent({
    automationType: TYPE,
    entityType: "approval",
    entityId: 0,
    recipient: jid,
    messagePreview: msg.slice(0, 200),
    status: ok ? "sent" : "failed",
    errorMessage: ok ? undefined : "WhatsApp send failed",
    executionTime: Date.now() - t0,
  });

  if (ok) result.sent++;
  else { result.failed++; result.errors.push("Pending approvals send failed"); }

  return result;
}

export async function runPendingApprovalsAutomation() {
  return runAutomation(TYPE, runPendingApprovals);
}
