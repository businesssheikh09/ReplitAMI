/**
 * Flight Reminder Automation
 * Hourly check: find flights departing within 24h, send customer reminder with PNR.
 */
import { db, flightRequestsTable } from "@workspace/db";
import { eq, and, gte, lt } from "drizzle-orm";
import { runAutomation, logAutomationEvent, isDuplicateToday, getTemplate, type AutomationResult } from "../automation-engine.js";
import { sendWhatsAppMessageSafe } from "./wa-helper.js";

const TYPE = "flight_reminder";

const DEFAULT_TEMPLATE = `✈️ *Flight Reminder*

Dear {clientName},

Your flight departs in approximately 24 hours. Here are your details:

✈️ Flight: *{airline}*
🛫 From: *{origin}* → *{destination}*
📅 Departure: *{departureDate}*
👥 Passengers: *{pax}*
🧳 Baggage: Please check allowance with airline before departure.

Important:
• Arrive at airport 3 hours before departure
• Carry original passport + printed boarding pass
• Confirm terminal with your ticket

Have a safe journey! 🌟
Al Musafir International`;

async function runFlightReminder(): Promise<AutomationResult> {
  const result: AutomationResult = { sent: 0, skipped: 0, failed: 0, errors: [] };
  const template = await getTemplate("template_flight_reminder", DEFAULT_TEMPLATE);

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const todayStr = now.toISOString().slice(0, 10);
  const tomorrowStr = in24h.toISOString().slice(0, 10);

  const requests = await db
    .select()
    .from(flightRequestsTable)
    .where(
      and(
        eq(flightRequestsTable.status, "confirmed"),
      )
    );

  const departureTomorrow = requests.filter(
    (r) => r.departureDate === tomorrowStr
  );

  for (const req of departureTomorrow) {
    const phone = req.clientWhatsapp || req.clientPhone || "";
    if (!phone) { result.skipped++; continue; }

    const jid = phone.replace(/\D/g, "") + "@s.whatsapp.net";
    if (await isDuplicateToday(TYPE, req.id, jid)) { result.skipped++; continue; }

    const flightData: any = req.flightDataJson ?? {};

    const msg = template
      .replace("{clientName}", req.clientName ?? "Passenger")
      .replace("{airline}", req.airline ?? flightData.airline ?? "Your Airline")
      .replace("{origin}", req.origin ?? "")
      .replace("{destination}", req.destination ?? "")
      .replace("{departureDate}", req.departureDate ?? tomorrowStr)
      .replace("{pax}", String(req.passengerCount ?? 1));

    const t0 = Date.now();
    const ok = await sendWhatsAppMessageSafe(jid, msg);

    await logAutomationEvent({
      automationType: TYPE,
      entityType: "flight_request",
      entityId: req.id,
      recipient: jid,
      messagePreview: msg.slice(0, 200),
      status: ok ? "sent" : "failed",
      errorMessage: ok ? undefined : "WhatsApp send failed",
      executionTime: Date.now() - t0,
    });

    if (ok) result.sent++;
    else { result.failed++; result.errors.push(`Flight ${req.id}: send failed`); }
  }

  return result;
}

export async function runFlightReminderAutomation() {
  return runAutomation(TYPE, runFlightReminder);
}
