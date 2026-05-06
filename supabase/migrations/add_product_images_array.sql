-- Migration to support multiple images per product
ALTER TABLE featured_products 
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}'::TEXT[];

-- Copy the existing primary image into the new array so no data is lost
UPDATE featured_products 
SET images = ARRAY[image_url] 
WHERE image_url IS NOT NULL AND (array_length(images, 1) IS NULL OR array_length(images, 1) = 0);
