-- Add user_id column to temporary_chats table
-- This allows us to fetch and display user profile images in the chat

ALTER TABLE temporary_chats ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Create an index on user_id for faster profile lookups
CREATE INDEX IF NOT EXISTS idx_temporary_chats_user_id 
  ON temporary_chats(user_id);
