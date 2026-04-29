-- Add delivery fields to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'pickup' CHECK (delivery_type IN ('pickup', 'delivery')),
ADD COLUMN IF NOT EXISTS delivery_choice TEXT CHECK (delivery_choice IN ('self', 'book_it'));

-- Update any existing orders to have 'pickup' as default
UPDATE orders SET delivery_type = 'pickup' WHERE delivery_type IS NULL;
