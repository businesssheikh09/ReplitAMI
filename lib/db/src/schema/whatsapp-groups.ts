import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const whatsappMonitoredGroupsTable = pgTable("whatsapp_monitored_groups", {
  id: serial("id").primaryKey(),
  jid: text("jid").notNull().unique(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type WhatsappMonitoredGroup = typeof whatsappMonitoredGroupsTable.$inferSelect;

/**
 * Lightweight jid → WhatsApp group subject (name) cache.
 * Populated by syncGroupNamesToDB() on every WhatsApp connect.
 * Used by the inbox to display real group names and filter by keywords.
 * Has NO relationship to the monitored-groups (ticket scraping) concept.
 */
export const whatsappGroupNamesTable = pgTable("whatsapp_group_names", {
  jid: text("jid").primaryKey(),
  subject: text("subject").notNull(),
  syncedAt: timestamp("synced_at").notNull().defaultNow(),
});

export type WhatsappGroupName = typeof whatsappGroupNamesTable.$inferSelect;
