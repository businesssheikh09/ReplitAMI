-- WhatsApp groups the agency wants to monitor for ticket allocations.
-- jid is the WhatsApp group ID (always ends in @g.us); CHECK enforces this.
CREATE TABLE IF NOT EXISTS "whatsapp_monitored_groups" (
  "id"         SERIAL PRIMARY KEY,
  "jid"        TEXT NOT NULL UNIQUE CHECK (jid LIKE '%@g.us'),
  "name"       TEXT NOT NULL,
  "enabled"    BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
