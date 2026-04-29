-- Migration: Create Temporary Chats Table
-- Date: 2025-02-10
-- Description: Create table for temporary chats that auto-delete daily at 1 AM

-- ============================================
-- 1. Create temporary_chats table
-- ============================================
CREATE TABLE IF NOT EXISTS temporary_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '24 hours')
);

-- ============================================
-- 2. Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_temporary_chats_shop_id 
  ON temporary_chats(shop_id);

CREATE INDEX IF NOT EXISTS idx_temporary_chats_created_at 
  ON temporary_chats(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_temporary_chats_expires_at 
  ON temporary_chats(expires_at);

CREATE INDEX IF NOT EXISTS idx_temporary_chats_shop_created 
  ON temporary_chats(shop_id, created_at DESC);

-- ============================================
-- 3. Enable Row Level Security
-- ============================================
ALTER TABLE temporary_chats ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. RLS Policies
-- ============================================

-- Policy: Anyone can view non-expired chats for a shop
CREATE POLICY "Anyone can view temporary chats for a shop"
  ON temporary_chats FOR SELECT
  USING (expires_at > now());

-- Policy: Anyone can insert temporary chats (anonymous)
CREATE POLICY "Anyone can insert temporary chats"
  ON temporary_chats FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 5. Create function for cleanup
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_chats()
RETURNS TABLE(deleted_count INT) AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  DELETE FROM temporary_chats
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN QUERY SELECT v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Create function to get chats for a shop
-- ============================================
CREATE OR REPLACE FUNCTION get_shop_chats(p_shop_id TEXT, p_limit INT DEFAULT 100)
RETURNS TABLE(
  id UUID,
  shop_id TEXT,
  user_name TEXT,
  user_email TEXT,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    temporary_chats.id,
    temporary_chats.shop_id,
    temporary_chats.user_name,
    temporary_chats.user_email,
    temporary_chats.message,
    temporary_chats.created_at
  FROM temporary_chats
  WHERE temporary_chats.shop_id = p_shop_id
    AND expires_at > now()
  ORDER BY temporary_chats.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Notes for Edge Function Setup
-- ============================================
-- To set up automatic cleanup at 1 AM daily:
-- 1. Create an Edge Function in supabase/functions/cleanup-chats/index.ts
-- 2. Deploy it
-- 3. Set up a cron job using supabase_functions.http_request_queue
--    or use an external scheduler like EasyCron
--
-- SQL alternative using pg_cron (if available):
-- SELECT cron.schedule('cleanup-temp-chats', '0 1 * * *', 'SELECT cleanup_expired_chats()');
