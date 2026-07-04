/**
 * Hotel Vendor Follow-up Automation
 * Every 4 hours: find hotel requests that were notified (notifiedAt set) but have
 * no vendor quote yet, send WhatsApp follow-up using hotel's vendorWhatsapp field.
 */
import { db, hotelRequestsTable, hotelsTable, vendorQuotesTable } from "@workspace/db";
import { eq, and, isNotNull, notExists } from "drizzle-orm";
import { runAutomation, logAutomationEvent, isDuplicateToday, getTemplate, type AutomationResult } from "../automation-engine.js";
import { sendWhatsAppMessageSafe } from "./wa-helper.js";

const TYPE = "hotel_vendor_followup";

const DEFAULT_TEMPLATE = `📋 *Quotation Follow-up*

We sent you a hotel request for:

🏨 Hotel: *{hotelName}*
📅 Check-in: *{checkIn}*
📅 Check-out: *{checkOut}*
👥 Rooms: *{rooms}* | Pax: *{pax}*

We haven't received your quotation yet. Kindly share your best rates at your earliest.

Ref: *{referenceNumber}*

Thank you,
Al Musafir International`;

async function runHotelVendorFollowup(): Promise<AutomationResult> {
  const result: AutomationResult = { sent: 0, skipped: 0, failed: 0, errors: [] };
  const template = await getTemplate("template_vendor_followup", DEFAULT_TEMPLATE);

  // Find requests that were notified but have no quotes yet
  const requests = await db
    .select({
      id: hotelRequestsTable.id,
      hotelName: hotelRequestsTable.hotelName,
      checkIn: hotelRequestsTable.checkIn,
      checkOut: hotelRequestsTable.checkOut,
      rooms: hotelRequestsTable.rooms,
      noOfPax: hotelRequestsTable.noOfPax,
      referenceNumber: hotelRequestsTable.referenceNumber,
      notifiedAt: hotelRequestsTable.notifiedAt,
      hotelId: hotelRequestsTable.hotelId,
      vendorWhatsapp: hotelsTable.vendorWhatsapp,
    })
    .from(hotelRequestsTable)
    .leftJoin(hotelsTable, eq(hotelRequestsTable.hotelId, hotelsTable.id))
    .where(
      and(
        isNotNull(hotelRequestsTable.notifiedAt),
        notExists(
          db.select({ id: vendorQuotesTable.id })
            .from(vendorQuotesTable)
            .where(eq(vendorQuotesTable.requestId, hotelRequestsTable.id))
        ),
      )
    );

  for (const req of requests) {
    const phone = req.vendorWhatsapp || "";
    if (!phone) { result.skipped++; continue; }

    const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net";
    if (await isDuplicateToday(TYPE, req.id, jid)) { result.skipped++; continue; }

    const msg = template
      .replace("{hotelName}", req.hotelName ?? "Hotel")
      .replace("{checkIn}", req.checkIn ? new Date(req.checkIn).toLocaleDateString() : "")
      .replace("{checkOut}", req.checkOut ? new Date(req.checkOut).toLocaleDateString() : "")
      .replace("{rooms}", String(req.rooms ?? 1))
      .replace("{pax}", String(req.noOfPax ?? 1))
      .replace("{referenceNumber}", req.referenceNumber ?? `#${req.id}`);

    const t0 = Date.now();
    const ok = await sendWhatsAppMessageSafe(jid, msg);

    await logAutomationEvent({
      automationType: TYPE,
      entityType: "hotel_request",
      entityId: req.id,
      recipient: jid,
      messagePreview: msg.slice(0, 200),
      status: ok ? "sent" : "failed",
      errorMessage: ok ? undefined : "WhatsApp send failed",
      executionTime: Date.now() - t0,
    });

    if (ok) result.sent++;
    else { result.failed++; result.errors.push(`Request ${req.id}: send failed`); }
  }

  return result;
}

export async function runHotelVendorFollowupAutomation() {
  return runAutomation(TYPE, runHotelVendorFollowup);
}
