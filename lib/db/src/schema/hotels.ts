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
  description: text("description"),
  category: text("category"),
  defaultVendorId: integer("default_vendor_id"),
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

export const hotelVendorsTable = pgTable("hotel_vendors", {
  id: serial("id").primaryKey(),
  hotelId: integer("hotel_id").notNull(),
  vendorId: integer("vendor_id").notNull(),
  priority: integer("priority").notNull().default(0),
  whatsapp: text("whatsapp"),
  whatsappGroupId: text("whatsapp_group_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const hotelRequestsTable = pgTable("hotel_requests", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  hotelName: text("hotel_name").notNull(),
  city: text("city").notNull(),
  checkIn: timestamp("check_in").notNull(),
  checkOut: timestamp("check_out").notNull(),
  rooms: integer("rooms").notNull().default(1),
  noOfPax: integer("no_of_pax").notNull().default(1),
  roomType: text("room_type").notNull(),
  mealPlan: text("meal_plan").notNull(),
  specialNotes: text("special_notes"),
  referenceNumber: text("reference_number"),
  hotelId: integer("hotel_id"),
  invoiceId: integer("invoice_id"),
  notifiedAt: timestamp("notified_at"),
  createdByUserId: integer("created_by_user_id"),
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
  currency: text("currency").notNull().default("SAR"),
  mealPlan: text("meal_plan"),
  roomType: text("room_type"),
  distance: text("distance"),
  availability: text("availability"),
  cancellationPolicy: text("cancellation_policy"),
  receivedBy: integer("received_by"),
  status: text("status").notNull().default("received"),
  vendorWhatsapp: text("vendor_whatsapp"),
  notes: text("notes"),
  isSelected: boolean("is_selected").notNull().default(false),
  respondedAt: timestamp("responded_at").notNull().defaultNow(),
});

export const hotelRequestEventsTable = pgTable("hotel_request_events", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  eventType: text("event_type").notNull(),
  statusBefore: text("status_before"),
  statusAfter: text("status_after"),
  notes: text("notes"),
  userId: integer("user_id"),
  userName: text("user_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHotelSchema = createInsertSchema(hotelsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHotel = z.infer<typeof insertHotelSchema>;
export type Hotel = typeof hotelsTable.$inferSelect;

export const insertVendorSchema = createInsertSchema(vendorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendorsTable.$inferSelect;
