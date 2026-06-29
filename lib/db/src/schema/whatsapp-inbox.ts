import { pgTable, serial, text, boolean, bigint, integer, timestamp, unique } from "drizzle-orm/pg-core";

/** Every group message received by the linked WhatsApp account, stored for ERP inbox. */
export const whatsappMessagesTable = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  groupJid: text("group_jid").notNull(),
  senderJid: text("sender_jid").notNull(),
  senderName: text("sender_name"),
  text: text("text").notNull().default(""),
  waMessageId: text("wa_message_id"),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  /** True for messages sent FROM the ERP (right-side bubbles in the inbox). */
  isSent: boolean("is_sent").notNull().default(false),
  /** Quoted message context for reply threads. */
  quotedWaId: text("quoted_wa_id"),
  quotedText: text("quoted_text"),
  quotedSenderName: text("quoted_sender_name"),
  /** Media attachment from Media Library */
  mediaLibraryId: integer("media_library_id"),
  mediaCaption: text("media_caption"),
});

export type WhatsappMessage = typeof whatsappMessagesTable.$inferSelect;

/**
 * Links a WhatsApp group to any ERP transaction.
 * entity_type values: flight_quotation | quotation | hotel_request | transport_booking | invoice | visa_application
 */
export const whatsappGroupLinksTable = pgTable(
  "whatsapp_group_links",
  {
    id: serial("id").primaryKey(),
    groupJid: text("group_jid").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    linkedAt: timestamp("linked_at").notNull().defaultNow(),
    linkedBy: integer("linked_by"),
  },
  (t) => [unique().on(t.groupJid, t.entityType, t.entityId)],
);

export type WhatsappGroupLink = typeof whatsappGroupLinksTable.$inferSelect;
