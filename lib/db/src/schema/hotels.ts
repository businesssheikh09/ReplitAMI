import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hotelsTable = pgTable("hotels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  stars: integer("stars").notNull().default(3),
  distanceFromHaram: text("distance_from_haram").notNull(),
  roomTypes: text("room_types").array(),
  mealPlans: text("meal_plans").array(),
  notes: text("notes"),
  imageUrl: text("image_url"),
  googleImageUrl: text("google_image_url"),
  vendorWhatsapp: text("vendor_whatsapp"),
  vendorWhatsappGroupId: text("vendor_whatsapp_group_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const vendorsTable = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  country: text("country").notNull(),
  rating: integer("rating"),
  totalDeals: integer("total_deals").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const hotelRequestsTable = pgTable("hotel_requests", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  hotelName: text("hotel_name").notNull(),
  city: text("city").notNull(),
  checkIn: timestamp("check_in").notNull(),
  checkOut: timestamp("check_out").notNull(),
  rooms: integer("rooms").notNull().default(1),
  roomType: text("room_type").notNull(),
  mealPlan: text("meal_plan").notNull(),
  specialNotes: text("special_notes"),
  status: text("status").notNull().default("pending"),
  selectedQuoteId: integer("selected_quote_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const vendorQuotesTable = pgTable("vendor_quotes", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  vendorId: integer("vendor_id").notNull(),
  pricePerRoom: integer("price_per_room").notNull(),
  totalPrice: integer("total_price"),
  currency: text("currency").notNull().default("USD"),
  notes: text("notes"),
  isSelected: boolean("is_selected").notNull().default(false),
  respondedAt: timestamp("responded_at").notNull().defaultNow(),
});

export const insertHotelSchema = createInsertSchema(hotelsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHotel = z.infer<typeof insertHotelSchema>;
export type Hotel = typeof hotelsTable.$inferSelect;

export const insertVendorSchema = createInsertSchema(vendorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendorsTable.$inferSelect;
