-- Group ticket allocations scraped from WhatsApp groups.
-- The unique index enforces one row per (airline, flight, date, origin, destination);
-- ON CONFLICT DO UPDATE in the scraper safely upserts duplicate messages.
CREATE TABLE IF NOT EXISTS "group_tickets" (
  "id" SERIAL PRIMARY KEY,
  "airline_code" TEXT NOT NULL,
  "flight_number" TEXT NOT NULL,
  "flight_date" DATE NOT NULL,
  "origin" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "seats" INTEGER NOT NULL,
  "departure_time" TEXT,
  "arrival_time" TEXT,
  "fare_amount" NUMERIC(14, 2),
  "fare_currency" TEXT NOT NULL DEFAULT 'PKR',
  "group_name" TEXT,
  "raw_message" TEXT,
  "scraped_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "group_tickets_flight_uniq"
  ON "group_tickets" ("airline_code", "flight_number", "flight_date", "origin", "destination");
