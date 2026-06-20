import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const whatsappMonitoredGroupsTable = pgTable("whatsapp_monitored_groups", {
  id: serial("id").primaryKey(),
  jid: text("jid").notNull().unique(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type WhatsappMonitoredGroup = typeof whatsappMonitoredGroupsTable.$inferSelect;
