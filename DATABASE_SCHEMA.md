# Database Schema Requirements

## Videos Table

The following table needs to be created in Supabase for the Short Videos feature:

```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_name TEXT NOT NULL,
  uploader_type TEXT NOT NULL CHECK (uploader_type IN ('shop', 'user')),
  uploader_id TEXT NOT NULL,
  video_url TEXT NOT NULL,
  duration INTEGER NOT NULL,
  caption TEXT,
  likes INTEGER DEFAULT 0,
  liked_by JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster searches and uniqueness checks
-- Index for case-insensitive profile name search
CREATE INDEX idx_videos_uploader_name_lower ON videos(LOWER(uploader_name));
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
```

## Storage Bucket

Create a new storage bucket named `videos` in Supabase Storage for storing video files.

Make sure the bucket has the following settings:
- **Public**: Allow public access (or configure based on your security needs)
- **Allowed MIME types**: video/*

## Shops Table Update

The shops table needs to support the new categories. Update the category column values:

```sql
-- Update existing categories
UPDATE shops SET category = 'parlour' WHERE category IN ('beauty-parlour', 'girl-saloon');

-- The category column should allow: 'salon', 'parlour', 'restaurant'
```

## Troubleshooting Profile Name Uniqueness Checks

If you're experiencing issues with the "profile name already taken" error when the name doesn't exist:

1. **Check data in Supabase**:
   - Go to your Supabase dashboard
   - Check the `videos` table for any entries with the profile name (case-insensitive)
   - Check the `shops` table for any entries with that name

2. **Clear browser cache**:
   - The app caches some data locally
   - Clear your browser's local storage: `localStorage.clear()`

3. **Verify table structure**:
   - Run this SQL query to check the videos table structure:
   ```sql
   SELECT column_name, data_type FROM information_schema.columns
   WHERE table_name = 'videos' ORDER BY ordinal_position;
   ```

4. **Test the API directly**:
   - You can test the Supabase query directly in the SQL editor:
   ```sql
   SELECT id, uploader_name FROM videos
   WHERE LOWER(uploader_name) = LOWER('your-test-name');
   ```

## Notes

- The `liked_by` field stores an array of user IDs as a JSONB array
- The `duration` field stores video duration in seconds (max 60 seconds enforced in app)
- The `uploader_name` field is checked case-insensitively across both videos and shops tables
- Profile names can contain spaces and up to 50 characters (minimum 3 characters)
- Ensure proper RLS (Row Level Security) policies are set if needed
