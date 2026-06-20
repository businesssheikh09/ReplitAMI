import cron from "node-cron";
import { db, groupTicketsTable, whatsappMonitoredGroupsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getRecentGroupMessages, getRecentGroupMessagesByJids } from "./whatsapp.js";
import { parseGroupTicketMessage } from "../lib/groupTicketParser.js";
import { logger } from "../lib/logger.js";

/** Env-var fallback: comma-separated name substrings (read once at startup). */
const FALLBACK_TARGET_GROUPS = (process.env["WHATSAPP_TARGET_GROUPS"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Query DB for ALL group rows to determine the configured state:
 * - Returns `null`  → table is completely empty → use env-var fallback
 * - Returns `{ jids: [], ... }` → rows exist but all disabled → scrape nothing (return early)
 * - Returns `{ jids: [...], ... }` → one or more groups enabled → scrape those JIDs
 */
async function getConfiguredJids(): Promise<{ jids: string[]; jidNames: Record<string, string> } | null> {
  try {
    const allRows = await db
      .select({
        jid: whatsappMonitoredGroupsTable.jid,
        name: whatsappMonitoredGroupsTable.name,
        enabled: whatsappMonitoredGroupsTable.enabled,
      })
      .from(whatsappMonitoredGroupsTable);

    // Table completely empty → caller falls back to env var
    if (allRows.length === 0) return null;

    // Table has rows — use only the enabled ones (may be empty list = scrape nothing)
    const enabledRows = allRows.filter((r) => r.enabled);
    const jidNames: Record<string, string> = {};
    for (const r of enabledRows) jidNames[r.jid] = r.name;
    return { jids: enabledRows.map((r) => r.jid), jidNames };
  } catch (err) {
    logger.error({ err }, "Failed to query WhatsApp group config — using env-var fallback");
    return null;
  }
}

async function scrapeAndUpsert(): Promise<void> {
  logger.info("Group ticket scrape started");

  let messages: { groupName: string; text: string; timestamp: number }[];
  const dbConfig = await getConfiguredJids();

  if (dbConfig === null) {
    // Table is empty — fall back to env var name-substring behaviour
    logger.info(
      { fallbackGroups: FALLBACK_TARGET_GROUPS.length },
      "No groups saved in DB — using WHATSAPP_TARGET_GROUPS env-var fallback",
    );
    messages = await getRecentGroupMessages(FALLBACK_TARGET_GROUPS, 24);
  } else if (dbConfig.jids.length === 0) {
    // Groups are configured but all disabled — do not scrape anything
    logger.info("All WhatsApp groups are disabled in DB — skipping scrape");
    return;
  } else {
    logger.info({ count: dbConfig.jids.length }, "Scraping DB-configured group JIDs");
    messages = getRecentGroupMessagesByJids(dbConfig.jids, 24, dbConfig.jidNames);
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
