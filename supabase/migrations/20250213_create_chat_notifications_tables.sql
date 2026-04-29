-- Table for tracking chat notifications (Layer 3 - Server-side processing)
CREATE TABLE IF NOT EXISTS chat_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_email TEXT,
  message TEXT NOT NULL,
  notification_type TEXT DEFAULT 'temporary_chat_message',
  status TEXT DEFAULT 'pending', -- pending, processed, sent, failed
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for tracking WhatsApp fallback notifications (Layer 2)
CREATE TABLE IF NOT EXISTS chat_notifications_fallback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'whatsapp', 'sms', etc.
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  whatsapp_url TEXT,
  status TEXT DEFAULT 'prepared', -- prepared, clicked, expired
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_chat_notifications_shop_id ON chat_notifications(shop_id);
CREATE INDEX IF NOT EXISTS idx_chat_notifications_status ON chat_notifications(status);
CREATE INDEX IF NOT EXISTS idx_chat_notifications_created_at ON chat_notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_notifications_fallback_shop_id ON chat_notifications_fallback(shop_id);
CREATE INDEX IF NOT EXISTS idx_chat_notifications_fallback_status ON chat_notifications_fallback(status);
CREATE INDEX IF NOT EXISTS idx_chat_notifications_fallback_created_at ON chat_notifications_fallback(created_at DESC);

-- Optional: RLS policies (adjust based on your security requirements)
ALTER TABLE chat_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_notifications_fallback ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert/update
CREATE POLICY "Allow service role to manage chat notifications"
  ON chat_notifications
  FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage chat notifications fallback"
  ON chat_notifications_fallback
  FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Clean up old notifications (auto-delete after 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_chat_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM chat_notifications WHERE created_at < NOW() - INTERVAL '30 days';
  DELETE FROM chat_notifications_fallback WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Optional: Uncomment below to schedule automatic cleanup (requires pg_cron)
-- SELECT cron.schedule('cleanup-chat-notifications', '0 2 * * *', 'SELECT cleanup_old_chat_notifications()');
