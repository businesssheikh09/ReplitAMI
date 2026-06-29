import { pgTable, serial, text, integer, bigint, jsonb, timestamp } from "drizzle-orm/pg-core";

export type MediaType = "image" | "video" | "audio" | "document";

export const mediaLibraryTable = pgTable("media_library", {
  id: serial("id").primaryKey(),
  storageKey: text("storage_key").notNull(),
  originalFilename: text("original_filename").notNull(),
  mediaType: text("media_type").$type<MediaType>().notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  uploadedBy: integer("uploaded_by"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  tags: jsonb("tags").$type<string[]>().default([]),
});

export type MediaLibraryItem = typeof mediaLibraryTable.$inferSelect;
export type InsertMediaLibraryItem = typeof mediaLibraryTable.$inferInsert;
