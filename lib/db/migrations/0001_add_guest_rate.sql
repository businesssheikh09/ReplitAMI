-- Add guest_rate column to currency_daily_rates for 3-tier rate support
-- Vendor Buy Rate (vendor_rate) | Guest Sell Rate (guest_rate) | Client/Subagent Rate (client_rate)
-- Column added with DEFAULT 0 so existing rows are preserved; default can be updated manually.
ALTER TABLE "currency_daily_rates" ADD COLUMN IF NOT EXISTS "guest_rate" numeric(12,4) NOT NULL DEFAULT 0;
