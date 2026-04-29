# Shop Category Migration Guide

## Overview
This document explains the migration from old shop categories (`beauty-parlour` and `girl-saloon`) to the new consolidated `parlour` category.

## Issues Fixed

### 1. **Migration Error: `Error migrating beauty-parlour shops: [object Object]`**
   - **Root Cause**: The client-side migration was failing due to Row Level Security (RLS) policies on the shops table
   - **Solution**: Created a SQL migration file that can be run directly in Supabase

### 2. **Missing Service Role Key**
   - **Issue**: The environment doesn't have `VITE_SUPABASE_SERVICE_ROLE_KEY` configured
   - **Impact**: Client-side migrations can't bypass RLS policies
   - **Solution**: Use SQL migrations for database-level operations

### 3. **Old Category Options Still Available in UI**
   - **Issue**: AddShopPage still allowed selecting old categories (`beauty-parlour`, `girl-saloon`)
   - **Solution**: Updated UI to only show new categories (`salon`, `parlour`, `restaurant`)

## How to Run the Migration

### Option 1: Run SQL Migration in Supabase Dashboard (Recommended)

1. Go to your Supabase dashboard: https://supabase.com
2. Select your project
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy and paste the contents of `supabase/migrations/20250128_migrate_shop_categories.sql`
6. Click **Run**

This will:
- Update all shops with `category = 'beauty-parlour'` to `category = 'parlour'`
- Update all shops with `category = 'girl-saloon'` to `category = 'parlour'`
- Set the `updated_at` timestamp

### Option 2: Automatic Migration on App Load (Client-Side)

The app now includes improved error handling for the client-side migration:

1. The migration runs automatically when the app loads
2. It attempts to use the service role key if available (from env var: `VITE_SUPABASE_SERVICE_ROLE_KEY`)
3. If the service role key is not available, it will attempt with the regular client
4. Detailed error messages are logged to the browser console

**Note**: If you want the client-side migration to work reliably, you need to add the service role key to your environment:

```bash
# Add to your .env.local file:
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

You can get the service role key from:
1. Supabase Dashboard
2. Project Settings → API
3. Copy the `service_role` (SECRET) key

## Verification

After running the migration, verify that it was successful:

### In Supabase Dashboard:

1. Go to **SQL Editor**
2. Run this query:
```sql
SELECT 
  category,
  COUNT(*) as shop_count
FROM shops
GROUP BY category
ORDER BY shop_count DESC;
```

You should see:
- `parlour`: [count of migrated shops]
- `salon`: [count of salon shops]
- `restaurant`: [count of restaurant shops]

### In Browser Console:

After the app loads, check the browser console (F12) for migration logs:
- ✅ `Successfully migrated beauty-parlour shops to parlour`
- ✅ `Successfully migrated girl-saloon shops to parlour`
- ✅ `Shop category migration completed`

## Changes Made

### 1. **Migration Code** (`src/lib/migrate-shop-categories.ts`)
   - Enhanced error logging with detailed error information
   - Added support for service role authentication
   - Better handling of edge cases (no rows found, etc.)
   - Informative console messages

### 2. **SQL Migration File** (`supabase/migrations/20250128_migrate_shop_categories.sql`)
   - Database-level migration for reliability
   - Updates `updated_at` timestamp for migrated records
   - Includes verification query

### 3. **UI Updates** (`src/components/AddShopPage.tsx`)
   - Removed `beauty-parlour` option from category select
   - Removed `girl-saloon` option from category select
   - Added `parlour` option with proper emoji (💄)

## Troubleshooting

### Error: "Error migrating beauty-parlour shops: [object Object]"
- This indicates the client-side migration is being blocked by RLS policies
- **Solution**: Run the SQL migration in Supabase Dashboard (Option 1 above)

### Error: "Service role key not available"
- The migration will still attempt with the regular client
- **Solution**: Add `VITE_SUPABASE_SERVICE_ROLE_KEY` to `.env.local`

### No shops were migrated
- Check if there are actually shops with the old categories using:
```sql
SELECT * FROM shops WHERE category IN ('beauty-parlour', 'girl-saloon');
```
- If this returns no rows, all shops have already been migrated

## Summary

The migration process has been improved with:
1. ✅ Better error handling and logging
2. ✅ SQL migration file for database-level execution
3. ✅ Updated UI to prevent new shops from using old categories
4. ✅ Support for service role authentication
5. ✅ Comprehensive verification methods

For immediate migration, run the SQL migration in Supabase Dashboard.
