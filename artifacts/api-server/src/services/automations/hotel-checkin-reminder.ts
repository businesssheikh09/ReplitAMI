/**
 * Hotel Check-in Reminder Automation
 * Every morning: find bookings checking in tomorrow, send customer reminder.
 */
import { db, hotelInvoicesTable, clientsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { runAutomation, logAutomationEvent, isDuplicateToday, getTemplate, type AutomationResult } from "../automation-engine.js";
import { sendWhatsAppMessageSafe } from "./wa-helper.js";

const TYPE = "hotel_checkin_reminder";

const DEFAULT_TEMPLATE = `🏨 *Hotel Check-in Reminder*

Dear {passengerName},

This is a friendly reminder that your hotel check-in is *tomorrow*!

🏨 Hotel: *{hotelName}*
📅 Check-in: *{checkIn}*
📅 Check-out: *{checkOut}*
🛏️ Room: *{roomType}*
👥 Pax: *{noOfPax}*
📋 Ref: *{cnfNumber}*

Please carry a valid ID. Contact us if you need assistance.

Al Musafir International`;

async function runHotelCheckinReminder(): Promise<AutomationResult> {
  const result: AutomationResult = { sent: 0, skipped: 0, failed: 0, errors: [] };
  const template = await getTemplate("template_hotel_reminder", DEFAULT_TEMPLATE);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const bookings = await db
    .select({
      id: hotelInvoicesTable.id,
      passengerName: hotelInvoicesTable.passengerName,
      hotelName: hotelInvoicesTable.hotelName,
      checkIn: hotelInvoicesTable.checkIn,
      checkOut: hotelInvoicesTable.checkOut,
      roomType: hotelInvoicesTable.roomType,
      noOfPax: hotelInvoicesTable.noOfPax,
      cnfNumber: hotelInvoicesTable.cnfNumber,
      contactNumber: hotelInvoicesTable.contactNumber,
      partyId: hotelInvoicesTable.partyId,
      clientWhatsapp: clientsTable.whatsapp,
      clientPhone: clientsTable.phone,
    })
    .from(hotelInvoicesTable)
    .leftJoin(clientsTable, eq(hotelInvoicesTable.partyId, clientsTable.id))
    .where(
      sql`DATE(${hotelInvoicesTable.checkIn}) = ${tomorrowStr}::date`
    );

  for (const b of bookings) {
    const phone = b.contactNumber || b.clientWhatsapp || b.clientPhone || "";
    if (!phone) { result.skipped++; continue; }

    const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net";
    if (await isDuplicateToday(TYPE, b.id, jid)) { result.skipped++; continue; }

    const msg = template
      .replace("{passengerName}", b.passengerName ?? "Guest")
      .replace("{hotelName}", b.hotelName ?? "Your Hotel")
      .replace("{checkIn}", b.checkIn ? String(b.checkIn) : tomorrowStr)
      .replace("{checkOut}", b.checkOut ? String(b.checkOut) : "")
      .replace("{roomType}", b.roomType ?? "Standard")
      .replace("{noOfPax}", String(b.noOfPax ?? 1))
      .replace("{cnfNumber}", b.cnfNumber ?? "—");

    const t0 = Date.now();
    const ok = await sendWhatsAppMessageSafe(jid, msg);

    await logAutomationEvent({
      automationType: TYPE,
      entityType: "hotel_invoice",
      entityId: b.id,
      recipient: jid,
      messagePreview: msg.slice(0, 200),
      status: ok ? "sent" : "failed",
      errorMessage: ok ? undefined : "WhatsApp send failed",
      executionTime: Date.now() - t0,
    });

    if (ok) result.sent++;
    else { result.failed++; result.errors.push(`Booking ${b.id}: send failed`); }
  }

  return result;
}

export async function runHotelCheckinReminderAutomation() {
  return runAutomation(TYPE, runHotelCheckinReminder);
}
