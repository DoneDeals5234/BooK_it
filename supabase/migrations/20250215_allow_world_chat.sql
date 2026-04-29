-- Migration: Allow World Chat as special temporary chat ID
-- Date: 2025-02-15
-- Description: Create a special "world-chat" shop entry for global temporary chats
--              and ensure the temporary_chats table can reference it properly

-- ============================================
-- 1. Insert the world-chat special shop entry if it doesn't exist
-- ============================================
INSERT INTO shops (id, name, location, owner_name, owner_email, owner_phone, password, category)
VALUES (
  'world-chat',
  'World Chat',
  'Global',
  'System',
  'system@bookit.local',
  '+00000000000',
  'world-chat-no-auth',
  'salon'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. Add index on temporary_chats for world-chat lookups
-- ============================================
CREATE INDEX IF NOT EXISTS idx_temporary_chats_world_chat 
  ON temporary_chats(shop_id) WHERE shop_id = 'world-chat';
