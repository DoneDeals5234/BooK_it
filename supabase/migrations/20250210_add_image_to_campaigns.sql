-- Add image column to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add description column for better campaign management
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS description TEXT;
