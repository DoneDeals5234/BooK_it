-- SQL Script to insert realistic products for Param Karyana Store
-- Note: Base64 strings are too large for this file (MBs in size), so realistic Unsplash URLs are used. 
-- The database currently only supports a single `image_url` per product in `featured_products`.

DO $$ 
DECLARE
    target_shop_id TEXT;
BEGIN
    -- Find the Shop ID for Param Karyana Store
    SELECT id INTO target_shop_id FROM shops WHERE name ILIKE '%param karyana%' OR name ILIKE '%param%' LIMIT 1;

    IF target_shop_id IS NULL THEN
        RAISE EXCEPTION 'Shop "Param Karyana Store" not found in the shops table.';
    END IF;

    -- Insert Lays
    INSERT INTO featured_products (shop_id, title, price, original_price, discount_percentage, category, image_url, description, is_active, display_order)
    VALUES (target_shop_id, 'Lays Classic Salted Chips (52g)', 20, 22, 9, 'snacks', 'https://images.unsplash.com/photo-1566478989037-e806f4772bb7?auto=format&fit=crop&q=80&w=400', 'Perfectly salted crispy potato chips. The classic snack for every occasion.', true, 1);

    -- Insert Kurkure
    INSERT INTO featured_products (shop_id, title, price, original_price, discount_percentage, category, image_url, description, is_active, display_order)
    VALUES (target_shop_id, 'Kurkure Masala Munch (90g)', 20, 22, 9, 'snacks', 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&q=80&w=400', 'Spicy, crunchy, and irresistible namkeen snack made with trusted kitchen ingredients.', true, 2);

    -- Insert Bingo
    INSERT INTO featured_products (shop_id, title, price, original_price, discount_percentage, category, image_url, description, is_active, display_order)
    VALUES (target_shop_id, 'Bingo! Mad Angles Tomato Madness', 20, 21, 5, 'snacks', 'https://images.unsplash.com/photo-1600952841320-1c62eb0d8082?auto=format&fit=crop&q=80&w=400', 'Experience the mad crunch and tangy tomato flavor with every triangular bite.', true, 3);

    -- Insert Doritos
    INSERT INTO featured_products (shop_id, title, price, original_price, discount_percentage, category, image_url, description, is_active, display_order)
    VALUES (target_shop_id, 'Doritos Nacho Cheese Tortilla Chips', 30, 33, 9, 'snacks', 'https://images.unsplash.com/photo-1613919113640-25732ec5e61f?auto=format&fit=crop&q=80&w=400', 'Tooth-rattling crunch and intense nacho cheese flavor.', true, 4);

    -- Insert Haldiram Bhujia
    INSERT INTO featured_products (shop_id, title, price, original_price, discount_percentage, category, image_url, description, is_active, display_order)
    VALUES (target_shop_id, 'Haldiram''s Aloo Bhujia (200g)', 50, 54, 7, 'snacks', 'https://images.unsplash.com/photo-1599490659213-e2b9527bb087?auto=format&fit=crop&q=80&w=400', 'Crunchy potato noodles flavored with a perfect blend of spices. A must-have tea time snack.', true, 5);

    -- Insert Namkeen
    INSERT INTO featured_products (shop_id, title, price, original_price, discount_percentage, category, image_url, description, is_active, display_order)
    VALUES (target_shop_id, 'Haldiram''s Navrattan Mixture (200g)', 55, 60, 8, 'snacks', 'https://images.unsplash.com/photo-1604152135912-00a02c98d840?auto=format&fit=crop&q=80&w=400', 'A delicious blend of savory noodles, peanuts, and lentils.', true, 6);

    -- Insert Parle-G
    INSERT INTO featured_products (shop_id, title, price, original_price, discount_percentage, category, image_url, description, is_active, display_order)
    VALUES (target_shop_id, 'Parle-G Gold Biscuits (1kg)', 120, 130, 8, 'snacks', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=400', 'The world''s largest selling biscuit. Filled with the goodness of milk and wheat.', true, 7);

    -- Insert Oreo
    INSERT INTO featured_products (shop_id, title, price, original_price, discount_percentage, category, image_url, description, is_active, display_order)
    VALUES (target_shop_id, 'Cadbury Oreo Vanilla Sandwich Biscuit', 40, 43, 7, 'snacks', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=400', 'Rich, smooth vanilla flavor cream sandwiched between two crunchy chocolate wafers.', true, 8);

    -- Insert Good Day
    INSERT INTO featured_products (shop_id, title, price, original_price, discount_percentage, category, image_url, description, is_active, display_order)
    VALUES (target_shop_id, 'Britannia Good Day Cashew Cookies', 30, 32, 6, 'snacks', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=400', 'Abundant butter and cashew cookies that bring a smile to your face.', true, 9);

    -- Insert Bourbon
    INSERT INTO featured_products (shop_id, title, price, original_price, discount_percentage, category, image_url, description, is_active, display_order)
    VALUES (target_shop_id, 'Britannia Bourbon Chocolate Cream Biscuits', 25, 27, 7, 'snacks', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=400', 'Smooth chocolate cream sprinkled with sugar crystals.', true, 10);

    -- Insert Maggi
    INSERT INTO featured_products (shop_id, title, price, original_price, discount_percentage, category, image_url, description, is_active, display_order)
    VALUES (target_shop_id, 'Maggi 2-Minute Masala Noodles (140g)', 28, 30, 7, 'instant', 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&q=80&w=400', 'India''s favorite instant noodles with the classic Maggi Masala tastemaker.', true, 11);

    -- Insert Yippee
    INSERT INTO featured_products (shop_id, title, price, original_price, discount_percentage, category, image_url, description, is_active, display_order)
    VALUES (target_shop_id, 'Sunfeast Yippee Magic Masala Noodles', 24, 26, 8, 'instant', 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&q=80&w=400', 'Long, non-sticky noodles with a special magic masala flavor.', true, 12);

    -- Insert Pasta
    INSERT INTO featured_products (shop_id, title, price, original_price, discount_percentage, category, image_url, description, is_active, display_order)
    VALUES (target_shop_id, 'Maggi Pazzta Masala Penne', 25, 28, 10, 'instant', 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&q=80&w=400', 'Delicious, quick, and easy to make penne pasta with lip-smacking masala flavor.', true, 13);

END $$;
