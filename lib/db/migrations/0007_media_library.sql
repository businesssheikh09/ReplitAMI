-- Media Library — shared asset store for WhatsApp campaigns and inbox attachments.
CREATE TABLE IF NOT EXISTS "media_library" (
  "id"                SERIAL PRIMARY KEY,
  "storage_key"       TEXT NOT NULL UNIQUE,
  "original_filename" TEXT NOT NULL,
  "media_type"        TEXT NOT NULL,
  "mime_type"         TEXT NOT NULL,
  "size_bytes"        BIGINT NOT NULL,
  "uploaded_by"       INTEGER,
  "uploaded_at"       TIMESTAMP NOT NULL DEFAULT NOW(),
  "tags"              JSONB DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS media_library_type ON "media_library" ("media_type");
CREATE INDEX IF NOT EXISTS media_library_uploaded ON "media_library" ("uploaded_at" DESC);

-- Extend whatsapp_messages with optional media attachment reference.
ALTER TABLE "whatsapp_messages"
  ADD COLUMN IF NOT EXISTS "is_sent"            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "quoted_wa_id"       TEXT,
  ADD COLUMN IF NOT EXISTS "quoted_text"        TEXT,
  ADD COLUMN IF NOT EXISTS "quoted_sender_name" TEXT,
  ADD COLUMN IF NOT EXISTS "media_library_id"   INTEGER REFERENCES "media_library"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "media_caption"      TEXT;

-- Ensure text column allows empty string for media-only messages.
ALTER TABLE "whatsapp_messages" ALTER COLUMN "text" SET DEFAULT '';

-- Extend bot_campaigns with optional media attachment reference.
ALTER TABLE "bot_campaigns"
  ADD COLUMN IF NOT EXISTS "delay_seconds"    INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "media_library_id" INTEGER REFERENCES "media_library"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "media_caption"    TEXT;
