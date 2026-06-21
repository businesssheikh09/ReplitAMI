-- WhatsApp message store — persists every incoming group message for the ERP inbox.
CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
  "id"            SERIAL PRIMARY KEY,
  "group_jid"     TEXT NOT NULL,
  "sender_jid"    TEXT NOT NULL,
  "sender_name"   TEXT,
  "text"          TEXT NOT NULL,
  "wa_message_id" TEXT UNIQUE,
  "timestamp"     BIGINT NOT NULL,
  "is_read"       BOOLEAN NOT NULL DEFAULT false,
  "created_at"    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS whatsapp_messages_group_ts ON "whatsapp_messages" ("group_jid", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS whatsapp_messages_unread   ON "whatsapp_messages" ("group_jid") WHERE "is_read" = false;

-- Links a WhatsApp group to any ERP transaction entity.
CREATE TABLE IF NOT EXISTS "whatsapp_group_links" (
  "id"          SERIAL PRIMARY KEY,
  "group_jid"   TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id"   INTEGER NOT NULL,
  "linked_at"   TIMESTAMP NOT NULL DEFAULT NOW(),
  "linked_by"   INTEGER,
  UNIQUE ("group_jid", "entity_type", "entity_id")
);
CREATE INDEX IF NOT EXISTS whatsapp_group_links_jid ON "whatsapp_group_links" ("group_jid");
