import cron from "node-cron";
import { db, groupTicketsTable, whatsappMonitoredGroupsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getRecentGroupMessages, getRecentGroupMessagesByJids } from "./whatsapp.js";
import { parseGroupTicketMessage } from "../lib/groupTicketParser.js";
import { logger } from "../lib/logger.js";

/** Env-var fallback: comma-separated name substrings (read once at startup). */
const FALLBACK_TARGET_GROUPS = (process.env["WHATSAPP_TARGET_GROUPS"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Query DB for enabled group JIDs at runtime.
 * Returns null if the table is empty (caller should use env-var fallback).
 */
async function getEnabledJids(): Promise<{ jids: string[]; jidNames: Record<string, string> } | null> {
  try {
    const rows = await db
      .select({ jid: whatsappMonitoredGroupsTable.jid, name: whatsappMonitoredGroupsTable.name })
      .from(whatsappMonitoredGroupsTable)
      .where(eq(whatsappMonitoredGroupsTable.enabled, true));

    if (rows.length === 0) return null;

    const jidNames: Record<string, string> = {};
    for (const r of rows) jidNames[r.jid] = r.name;
    return { jids: rows.map((r) => r.jid), jidNames };
  } catch (err) {
    logger.error({ err }, "Failed to query enabled WhatsApp groups — using env-var fallback");
    return null;
  }
}

async function scrapeAndUpsert(): Promise<void> {
  logger.info("Group ticket scrape started");

  // Prefer DB-configured JIDs; fall back to env var if none are saved
  let messages: { groupName: string; text: string; timestamp: number }[];
  const dbConfig = await getEnabledJids();

  if (dbConfig) {
    logger.info({ count: dbConfig.jids.length }, "Scraping using DB-configured group JIDs");
    messages = getRecentGroupMessagesByJids(dbConfig.jids, 24, dbConfig.jidNames);
  } else {
    logger.info(
      { fallbackGroups: FALLBACK_TARGET_GROUPS.length },
      "No DB groups configured — using env-var fallback",
    );
    messages = await getRecentGroupMessages(FALLBACK_TARGET_GROUPS, 24);
  }

  if (messages.length === 0) {
    logger.info("No WhatsApp messages found — skipping upsert");
    return;
  }

  let upserted = 0;
  for (const msg of messages) {
    const parsed = parseGroupTicketMessage(msg.text);
    for (const ticket of parsed) {
      try {
        await db.execute(sql`
          INSERT INTO group_tickets (
            airline_code, flight_number, flight_date,
            origin, destination, seats,
            departure_time, arrival_time,
            fare_amount, fare_currency,
            group_name, raw_message, scraped_at, updated_at
          ) VALUES (
            ${ticket.airlineCode}, ${ticket.flightNumber}, ${ticket.flightDate},
            ${ticket.origin}, ${ticket.destination}, ${ticket.seats},
            ${ticket.departureTime}, ${ticket.arrivalTime},
            ${ticket.fareAmount}, ${ticket.fareCurrency},
            ${msg.groupName}, ${msg.text}, now(), now()
          )
          ON CONFLICT (airline_code, flight_number, flight_date, origin, destination)
          DO UPDATE SET
            seats        = EXCLUDED.seats,
            departure_time = EXCLUDED.departure_time,
            arrival_time   = EXCLUDED.arrival_time,
            fare_amount    = EXCLUDED.fare_amount,
            fare_currency  = EXCLUDED.fare_currency,
            group_name     = EXCLUDED.group_name,
            raw_message    = EXCLUDED.raw_message,
            scraped_at     = now(),
            updated_at     = now()
        `);
        upserted++;
      } catch (err) {
        logger.error({ err, ticket }, "Failed to upsert group ticket");
      }
    }
  }
  logger.info({ upserted, messages: messages.length }, "Group ticket scrape complete");
}

export function startScheduler(): void {
  cron.schedule("0 13 * * *", () => {
    scrapeAndUpsert().catch((err) => logger.error({ err }, "Scheduler error"));
  });
  logger.info("Group ticket scheduler registered — fires daily at 13:00");
}

export { scrapeAndUpsert };
