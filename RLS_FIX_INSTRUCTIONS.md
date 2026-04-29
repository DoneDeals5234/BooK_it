# Fix Video RLS Policy Issue - Step by Step

## The Problem

Your video shows a play button but won't start playing. This is because **Row Level Security (RLS) policies** on Supabase Storage are blocking access to the video files. Even though the video URL is correct, the storage policies prevent it from being served.

## Solution: Two Steps

### STEP 1: Test if RLS is the Issue (Temporary Fix)

**1. Go to Supabase Dashboard**
- Open: https://supabase.com
- Select your project (barberapp2)

**2. Go to SQL Editor**
- Click on **SQL Editor** in the left sidebar
- Click **New Query**

**3. Copy and Paste the DISABLE code**

Copy all the code from `DISABLE_RLS_TESTING.sql` (the file created with "Step 1: Disable RLS...")

It starts with:
```sql
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

**4. Run the Query**
- Click **Run** button (or Ctrl+Enter)
- You should see: ✅ "Success. No rows returned"

**5. Test the Video**
- Go back to your app
- Reload the page (F5)
- Try playing the video again
- **If it works now** → RLS was the issue! Continue to STEP 2.
- **If it still doesn't work** → Different issue, check browser console (F12 → Console tab)

---

### STEP 2: Apply Proper RLS Policies (Permanent Fix)

Once you confirm RLS was the issue:

**1. Go back to SQL Editor in Supabase**
- Click **New Query** again

**2. Copy and Paste the PROPER POLICIES code**

Copy all the code from `PROPER_RLS_POLICIES.sql`

It starts with:
```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

This code will:
- ✅ Re-enable RLS (for security)
- ✅ Allow PUBLIC users to READ videos
- ✅ Allow authenticated users to UPLOAD videos
- ✅ Keep the system secure

**3. Run the Query**
- Click **Run**
- You should see: ✅ Success messages

**4. Verify it Works**
- Go back to your app
- Reload the page
- Try playing the video
- It should now work! ✅

---

## What Each SQL File Does

### DISABLE_RLS_TESTING.sql
**When to use**: Testing - to confirm RLS is blocking videos

**What it does**:
1. Turns OFF all Row Level Security on storage tables
2. Removes all policies
3. Allows anyone to access storage without restrictions

**⚠️ Warning**: This is INSECURE. Only use for testing!

**Verification included**: Shows current RLS status of storage tables

---

### PROPER_RLS_POLICIES.sql
**When to use**: After confirming RLS is the issue - to fix it properly

**What it does**:
1. Re-enables RLS for security
2. Adds policy: Anyone can READ videos ✅
3. Adds policy: Authenticated users can UPLOAD videos ✅
4. Adds policy: Users can DELETE their own videos ✅
5. Adds policy: Users can UPDATE their own videos ✅

**Result**: Videos work + System stays secure ✅

**Verification included**: Shows all policies and video bucket statistics

---

## Quick Reference: Copy-Paste Commands

### To DISABLE RLS (Testing Only)
```sql
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;
```

### To ENABLE RLS with Public Read Access (Proper Fix)
```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON storage.objects
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read buckets"
  ON storage.buckets
  FOR SELECT
  TO public
  USING (true);
```

---

## Troubleshooting

### Query Failed: "Permission Denied"
- Make sure you're logged in as **project owner** in Supabase
- You need admin permissions to modify RLS policies

### Video Still Shows Play Button After Fix
- Clear your browser cache (Ctrl+Shift+Delete)
- Reload the app
- Check browser console (F12 → Console) for other errors

### Already Disabled and Works - What Now?
- Run the PROPER_RLS_POLICIES.sql to re-enable security
- Your videos will continue to work
- Your app will be secure

---

## After the Fix

✅ Videos will play without the play button overlay
✅ Users can upload new videos
✅ RLS policies keep your storage secure
✅ System works correctly

**Done!** Your video playback issue should be resolved.

If you have questions, check your browser console (F12) for detailed error messages.
