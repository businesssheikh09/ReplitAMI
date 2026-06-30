ALTER TABLE bot_campaigns
  ADD COLUMN IF NOT EXISTS recipient_mode text NOT NULL DEFAULT 'all';
