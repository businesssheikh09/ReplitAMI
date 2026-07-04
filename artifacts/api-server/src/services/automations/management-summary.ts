/**
 * Daily Management Summary Automation
 * Every morning: compile key metrics and send to management WhatsApp.
 */
import { db, hotelInvoicesTable, flightRequestsTable, vouchersTable, invoicesTable, whatsappMessagesTable, websiteConfigTable } from "@workspace/db";
import { eq, and, sql, gte, count, lt } from "drizzle-orm";
import { runAutomation, logAutomationEvent, getTemplate, type AutomationResult } from "../automation-engine.js";
import { sendWhatsAppMessageSafe } from "./wa-helper.js";

const TYPE = "management_summary";

const DEFAULT_TEMPLATE = `📊 *Daily Management Summary*
*{date}*

🛫 *Operations Today*
• Departures: {departures}
• Arrivals: {arrivals}
• Hotel Check-ins: {checkins}
• Hotel Check-outs: {checkouts}

⏳ *Pending Items*
• Hotel Confirmations: {pendingHotels}
• Pending Vouchers: {draftVouchers}
• Unpaid Invoices: {unpaidInvoices}
• Flight Requests: {pendingFlights}

💰 *Financials*
• Outstanding Receivables: PKR {receivables}
• Outstanding Payables: PKR {payables}

💬 WhatsApp Unread: {unread}

Al Musafir International ERP`;

async function runManagementSummary(): Promise<AutomationResult> {
  const result: AutomationResult = { sent: 0, skipped: 0, failed: 0, errors: [] };
  const template = await getTemplate("template_management_summary", DEFAULT_TEMPLATE);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  // Gather stats
  const [checkinsRes] = await db
    .select({ c: count() })
    .from(hotelInvoicesTable)
    .where(sql`DATE(${hotelInvoicesTable.checkIn}) = ${todayStr}::date`);

  const [checkoutsRes] = await db
    .select({ c: count() })
    .from(hotelInvoicesTable)
    .where(sql`DATE(${hotelInvoicesTable.checkOut}) = ${todayStr}::date`);

  const [pendingHotels] = await db
    .select({ c: count() })
    .from(hotelInvoicesTable)
    .where(eq(hotelInvoicesTable.status, "draft"));

  const [draftVouchers] = await db
    .select({ c: count() })
    .from(vouchersTable)
    .where(eq(vouchersTable.status, "draft"));

  const [unpaidInvoices] = await db
    .select({ c: count() })
    .from(invoicesTable)
    .where(eq(invoicesTable.status, "unpaid"));

  const [pendingFlights] = await db
    .select({ c: count() })
    .from(flightRequestsTable)
    .where(eq(flightRequestsTable.status, "pending"));

  const [receivablesRes] = await db
    .select({ total: sql<string>`COALESCE(SUM(amount - paid_amount), 0)` })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.type, "customer"), eq(invoicesTable.status, "unpaid")));

  const [payablesRes] = await db
    .select({ total: sql<string>`COALESCE(SUM(amount - paid_amount), 0)` })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.type, "vendor"), eq(invoicesTable.status, "unpaid")));

  const [unreadRes] = await db
    .select({ c: count() })
    .from(whatsappMessagesTable)
    .where(and(eq(whatsappMessagesTable.isRead, false), eq(whatsappMessagesTable.isSent, false)));

  // Get management WhatsApp number from website config
  const configRows = await db.select().from(websiteConfigTable);
  const configMap: Record<string, string> = {};
  for (const r of configRows) configMap[r.key] = r.value;
  const mgmtPhone = configMap["company_whatsapp"] || configMap["contact_whatsapp"] || "";

  if (!mgmtPhone) {
    result.skipped++;
    result.errors.push("No management WhatsApp number configured");
    return result;
  }

  const jid = mgmtPhone.replace(/\D/g, "") + "@s.whatsapp.net";

  const msg = template
    .replace("{date}", now.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" }))
    .replace("{departures}", "—")
    .replace("{arrivals}", "—")
    .replace("{checkins}", String(checkinsRes?.c ?? 0))
    .replace("{checkouts}", String(checkoutsRes?.c ?? 0))
    .replace("{pendingHotels}", String(pendingHotels?.c ?? 0))
    .replace("{draftVouchers}", String(draftVouchers?.c ?? 0))
    .replace("{unpaidInvoices}", String(unpaidInvoices?.c ?? 0))
    .replace("{pendingFlights}", String(pendingFlights?.c ?? 0))
    .replace("{receivables}", Number(receivablesRes?.total ?? 0).toLocaleString())
    .replace("{payables}", Number(payablesRes?.total ?? 0).toLocaleString())
    .replace("{unread}", String(unreadRes?.c ?? 0));

  const t0 = Date.now();
  const ok = await sendWhatsAppMessageSafe(jid, msg);

  await logAutomationEvent({
    automationType: TYPE,
    entityType: "summary",
    entityId: 0,
    recipient: jid,
    messagePreview: msg.slice(0, 200),
    status: ok ? "sent" : "failed",
    errorMessage: ok ? undefined : "WhatsApp send failed",
    executionTime: Date.now() - t0,
  });

  if (ok) result.sent++;
  else { result.failed++; result.errors.push("Management summary send failed"); }

  return result;
}

export async function runManagementSummaryAutomation() {
  return runAutomation(TYPE, runManagementSummary);
}
