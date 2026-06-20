-- DN Invoice sequence for race-condition-safe number allocation.
-- Starts at 2187 so the first issued number is DN-2187.
-- The hotel_invoices.dn_number column default uses this sequence.
CREATE SEQUENCE IF NOT EXISTS dn_invoice_seq START WITH 2187;
ALTER TABLE hotel_invoices
  ALTER COLUMN dn_number SET DEFAULT 'DN-' || nextval('dn_invoice_seq')::text;
