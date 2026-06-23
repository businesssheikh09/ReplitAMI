import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export type BotContact = { jid: string; name: string | null };

export const botCampaignsTable = pgTable("bot_campaigns", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  contacts: jsonb("contacts").$type<BotContact[]>().notNull(),
  currentIndex: integer("current_index").notNull().default(0),
  status: text("status").notNull().default("idle"),
  nextSendAt: timestamp("next_send_at"),
  delaySeconds: integer("delay_seconds").notNull().default(20),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const botCampaignSendsTable = pgTable("bot_campaign_sends", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  jid: text("jid").notNull(),
  name: text("name"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  waMessageId: text("wa_message_id"),
});

export type BotCampaign = typeof botCampaignsTable.$inferSelect;
export type BotCampaignSend = typeof botCampaignSendsTable.$inferSelect;
