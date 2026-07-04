/**
 * Automation Scheduler — registers all 8 automation cron jobs.
 * Each automation reads its enabled/cron config from the DB on each tick.
 */
import cron from "node-cron";
import { db, automationConfigsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { runPaymentReminderAutomation } from "./automations/payment-reminders.js";
import { runHotelCheckinReminderAutomation } from "./automations/hotel-checkin-reminder.js";
import { runHotelVendorFollowupAutomation } from "./automations/hotel-vendor-followup.js";
import { runFlightReminderAutomation } from "./automations/flight-reminder.js";
import { runPassportExpiryAutomation } from "./automations/passport-expiry.js";
import { runVisaExpiryAutomation } from "./automations/visa-expiry.js";
import { runManagementSummaryAutomation } from "./automations/management-summary.js";
import { runPendingApprovalsAutomation } from "./automations/pending-approvals.js";

export const AUTOMATION_DEFINITIONS = [
  {
    type: "payment_reminder",
    name: "Payment Reminder",
    description: "Detects overdue invoices (1/2/7/14/30 days) and sends WhatsApp reminders.",
    defaultCron: "0 9 * * *",
  },
  {
    type: "hotel_checkin_reminder",
    name: "Hotel Check-in Reminder",
    description: "Sends check-in reminder to guests checking in tomorrow.",
    defaultCron: "0 8 * * *",
  },
  {
    type: "hotel_vendor_followup",
    name: "Hotel Vendor Follow-up",
    description: "Follows up with vendors who haven't responded with a quotation.",
    defaultCron: "0 */4 * * *",
  },
  {
    type: "flight_reminder",
    name: "Flight Reminder",
    description: "Reminds passengers 24 hours before departure.",
    defaultCron: "0 * * * *",
  },
  {
    type: "passport_expiry",
    name: "Passport Expiry Alerts",
    description: "Alerts staff for passports expiring in 90/60/30 days.",
    defaultCron: "0 10 * * 1",
  },
  {
    type: "visa_expiry",
    name: "Visa Expiry Alerts",
    description: "Notifies clients for visas expiring in 30/15/7 days.",
    defaultCron: "0 10 * * 1",
  },
  {
    type: "management_summary",
    name: "Daily Management Summary",
    description: "Sends a morning summary of operations to management.",
    defaultCron: "0 8 * * *",
  },
  {
    type: "pending_approvals",
    name: "Pending Approval Alerts",
    description: "Notifies management of items awaiting approval every 2 hours.",
    defaultCron: "0 */2 * * *",
  },
] as const;

export type AutomationType = typeof AUTOMATION_DEFINITIONS[number]["type"];

const RUNNERS: Record<AutomationType, () => Promise<any>> = {
  payment_reminder: runPaymentReminderAutomation,
  hotel_checkin_reminder: runHotelCheckinReminderAutomation,
  hotel_vendor_followup: runHotelVendorFollowupAutomation,
  flight_reminder: runFlightReminderAutomation,
  passport_expiry: runPassportExpiryAutomation,
  visa_expiry: runVisaExpiryAutomation,
  management_summary: runManagementSummaryAutomation,
  pending_approvals: runPendingApprovalsAutomation,
};

async function isAutomationEnabled(type: string): Promise<boolean> {
  try {
    const [row] = await db
      .select({ enabled: automationConfigsTable.enabled })
      .from(automationConfigsTable)
      .where(eq(automationConfigsTable.type, type));
    return row?.enabled ?? false;
  } catch {
    return false;
  }
}

export async function runAutomationByType(type: string): Promise<any> {
  const runner = RUNNERS[type as AutomationType];
  if (!runner) throw new Error(`Unknown automation type: ${type}`);
  return runner();
}

export function startAutomationScheduler(): void {
  for (const def of AUTOMATION_DEFINITIONS) {
    cron.schedule(def.defaultCron, async () => {
      const enabled = await isAutomationEnabled(def.type);
      if (!enabled) return;
      logger.info({ type: def.type }, "Automation cron fired");
      RUNNERS[def.type]().catch((err) =>
        logger.error({ err, type: def.type }, "Automation cron error"),
      );
    });
    logger.info({ type: def.type, cron: def.defaultCron }, "Automation registered");
  }
  logger.info("Automation scheduler started");
}
