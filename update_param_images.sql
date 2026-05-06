-- SQL Script to update Param Karyana Store products with REAL company images

DO $$ 
DECLARE
    target_shop_id TEXT;
BEGIN
    -- Find the Shop ID for Param Karyana Store
    SELECT id INTO target_shop_id FROM shops WHERE name ILIKE '%param karyana%' OR name ILIKE '%param%' LIMIT 1;

    IF target_shop_id IS NULL THEN
        RAISE EXCEPTION 'Shop "Param Karyana Store" not found in the shops table.';
    END IF;

    -- Update Lays
    UPDATE featured_products 
    SET image_url = 'https://www.bigbasket.com/media/uploads/p/l/266160_19-lays-potato-chips-classic-salted.jpg',
        images = ARRAY['https://www.bigbasket.com/media/uploads/p/l/266160_19-lays-potato-chips-classic-salted.jpg']
    WHERE shop_id = target_shop_id AND title ILIKE '%Lays%';

    -- Update Kurkure
    UPDATE featured_products 
    SET image_url = 'https://www.bigbasket.com/media/uploads/p/l/281026_10-kurkure-namkeen-masala-munch.jpg',
        images = ARRAY['https://www.bigbasket.com/media/uploads/p/l/281026_10-kurkure-namkeen-masala-munch.jpg']
    WHERE shop_id = target_shop_id AND title ILIKE '%Kurkure%';

    -- Update Bingo
    UPDATE featured_products 
    SET image_url = 'https://www.bigbasket.com/media/uploads/p/l/266580_16-bingo-mad-angles-tomato-madness.jpg',
        images = ARRAY['https://www.bigbasket.com/media/uploads/p/l/266580_16-bingo-mad-angles-tomato-madness.jpg']
    WHERE shop_id = target_shop_id AND title ILIKE '%Bingo%';

    -- Update Doritos
    UPDATE featured_products 
    SET image_url = 'https://www.bigbasket.com/media/uploads/p/l/40193731_2-doritos-nacho-cheese-tortilla-chips.jpg',
        images = ARRAY['https://www.bigbasket.com/media/uploads/p/l/40193731_2-doritos-nacho-cheese-tortilla-chips.jpg']
    WHERE shop_id = target_shop_id AND title ILIKE '%Doritos%';

    -- Update Haldiram Bhujia
    UPDATE featured_products 
    SET image_url = 'https://www.bigbasket.com/media/uploads/p/l/40001301_8-haldirams-bhujia-aloo.jpg',
        images = ARRAY['https://www.bigbasket.com/media/uploads/p/l/40001301_8-haldirams-bhujia-aloo.jpg']
    WHERE shop_id = target_shop_id AND title ILIKE '%Haldiram%Aloo%';

    -- Update Parle-G
    UPDATE featured_products 
    SET image_url = 'https://www.bigbasket.com/media/uploads/p/l/102024_7-parle-g-biscuits-original-glucose.jpg',
        images = ARRAY['https://www.bigbasket.com/media/uploads/p/l/102024_7-parle-g-biscuits-original-glucose.jpg']
    WHERE shop_id = target_shop_id AND title ILIKE '%Parle-G%';

    -- Update Oreo
    UPDATE featured_products 
    SET image_url = 'https://www.bigbasket.com/media/uploads/p/l/265882_16-cadbury-oreo-creme-biscuit-vanilla-original.jpg',
        images = ARRAY['https://www.bigbasket.com/media/uploads/p/l/265882_16-cadbury-oreo-creme-biscuit-vanilla-original.jpg']
    WHERE shop_id = target_shop_id AND title ILIKE '%Oreo%';

    -- Update Good Day
    UPDATE featured_products 
    SET image_url = 'https://www.bigbasket.com/media/uploads/p/l/100021316_8-britannia-good-day-cashew-cookies.jpg',
        images = ARRAY['https://www.bigbasket.com/media/uploads/p/l/100021316_8-britannia-good-day-cashew-cookies.jpg']
    WHERE shop_id = target_shop_id AND title ILIKE '%Good Day%';

    -- Update Bourbon
    UPDATE featured_products 
    SET image_url = 'https://www.bigbasket.com/media/uploads/p/l/267923_14-britannia-bourbon-chocolate-cream-biscuits.jpg',
        images = ARRAY['https://www.bigbasket.com/media/uploads/p/l/267923_14-britannia-bourbon-chocolate-cream-biscuits.jpg']
    WHERE shop_id = target_shop_id AND title ILIKE '%Bourbon%';

    -- Update Maggi
    UPDATE featured_products 
    SET image_url = 'https://www.bigbasket.com/media/uploads/p/l/266109_15-maggi-2-minute-instant-noodles-masala.jpg',
        images = ARRAY['https://www.bigbasket.com/media/uploads/p/l/266109_15-maggi-2-minute-instant-noodles-masala.jpg']
    WHERE shop_id = target_shop_id AND title ILIKE '%Maggi%Noodle%';

    -- Update Yippee
    UPDATE featured_products 
    SET image_url = 'https://www.bigbasket.com/media/uploads/p/l/265691_10-sunfeast-yippee-magic-masala-noodles.jpg',
        images = ARRAY['https://www.bigbasket.com/media/uploads/p/l/265691_10-sunfeast-yippee-magic-masala-noodles.jpg']
    WHERE shop_id = target_shop_id AND title ILIKE '%Yippee%';

    -- Update Pasta
    UPDATE featured_products 
    SET image_url = 'https://www.bigbasket.com/media/uploads/p/l/1205315_2-maggi-pazzta-masala-penne.jpg',
        images = ARRAY['https://www.bigbasket.com/media/uploads/p/l/1205315_2-maggi-pazzta-masala-penne.jpg']
    WHERE shop_id = target_shop_id AND title ILIKE '%Pazzta%';

END $$;
