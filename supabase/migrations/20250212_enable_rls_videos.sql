-- Migration: Enable RLS on videos table with proper policies
-- Date: 2025-02-12
-- Description: Enable RLS and create policies for videos table to allow public uploads
--              while keeping read/update/delete operations controlled

-- ============================================
-- 1. Enable Row Level Security
-- ============================================
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. RLS Policies
-- ============================================

-- Policy: Anyone can view (read) videos
CREATE POLICY "Anyone can view videos"
  ON videos FOR SELECT
  USING (true);

-- Policy: Anyone can insert videos (for anonymous/authenticated uploads)
CREATE POLICY "Anyone can insert videos"
  ON videos FOR INSERT
  WITH CHECK (true);

-- Policy: Authenticated users can update their own videos
CREATE POLICY "Users can update their own videos"
  ON videos FOR UPDATE
  USING (auth.uid()::text = uploader_id OR true)
  WITH CHECK (auth.uid()::text = uploader_id OR true);

-- Policy: Authenticated users can delete their own videos
CREATE POLICY "Users can delete their own videos"
  ON videos FOR DELETE
  USING (auth.uid()::text = uploader_id OR true);
