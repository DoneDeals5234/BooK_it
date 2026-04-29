# Supabase Edge Function Deployment Guide

## Issue
Your app is trying to send push notifications via the `send-booking-notification` Edge Function, but it's returning a **404 error** because the function hasn't been deployed to Supabase yet.

## Prerequisites
- ✅ Supabase account (already set up at https://omkrfehuvftntuqjmxqq.supabase.co)
- ✅ Your Supabase Anon Key and URL are configured in `.env`
- ✅ You need the VAPID private key (we'll generate it if needed)

## Step 1: Generate VAPID Keys (If You Don't Have Them)

If you don't have the VAPID private key, you need to generate a key pair:

### Option A: Using Web Push Encryption (Recommended)
1. Go to: https://web-push-codelab.glitch.me/
2. Click "Generate Keys" 
3. Copy both keys:
   - **Public Key** (already in your `.env`)
   - **Private Key** (you'll need this for Supabase)

### Option B: Using Node.js
```bash
npm install -g web-push
web-push generate-vapid-keys
```

This will output:
```
Public key: <your-public-key>
Private key: <your-private-key>
```

## Step 2: Add VAPID Private Key to Supabase

1. Go to **Supabase Dashboard**: https://app.supabase.com
2. Select your project: **your project name**
3. In the left sidebar, click **Settings** → **Project Settings**
4. Click **Vault** (or **Edge Functions** section)
5. Look for **Environment Variables** and click **Create new**
6. Add:
   - **Name**: `VAPID_PRIVATE_KEY`
   - **Value**: `<paste-your-private-key-here>`
7. Click **Create**

## Step 3: Deploy the Edge Function

### Using Supabase CLI (Recommended)

1. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**
   ```bash
   supabase login
   ```
   (You'll be prompted to create an access token. Go to: https://app.supabase.com/account/tokens)

3. **Deploy the function**
   ```bash
   supabase functions deploy send-booking-notification
   ```

   You should see:
   ```
   ✓ Function deployed successfully
   Endpoint: https://omkrfehuvftntuqjmxqq.supabase.co/functions/v1/send-booking-notification
   ```

### Using Supabase Dashboard (Alternative)

1. Go to **Supabase Dashboard** → Your Project
2. Click **Functions** in the left sidebar
3. Click **Create a new function**
4. Name it: `send-booking-notification`
5. Copy the entire code from `supabase/functions/send-booking-notification/index.ts`
6. Paste it into the Supabase function editor
7. Click **Deploy**

## Step 4: Verify the Deployment

1. Check the function is deployed:
   ```bash
   supabase functions list
   ```
   You should see `send-booking-notification` in the list.

2. In Supabase Dashboard, go to **Functions** and verify it's listed

3. Look for any errors in the **Logs** tab

## Step 5: Test the Notifications

1. Open your app: http://localhost:5173
2. Allow push notifications when prompted
3. Make a booking
4. You should see:
   - ✅ No 404 errors in console
   - ✅ "Edge Function called successfully" message
   - ✅ Push notification on your device (if enabled)

## Troubleshooting

### Error: "Function not found"
- Make sure you ran `supabase functions deploy send-booking-notification`
- Wait 30 seconds for deployment to complete
- Refresh your browser

### Error: "VAPID_PRIVATE_KEY is not set"
- Go back to Step 2 and add the environment variable to Supabase
- Wait 1 minute for the change to propagate
- Redeploy the function

### Error: "User has not enabled push notifications"
- This is expected if the user hasn't granted notification permission
- Check the browser console for "✅ Push notifications initialized"
- If it shows "⚠️ Push notifications not available", the service worker registration may have failed

### Still getting 404 errors?
- Check that your Supabase URL in `.env` matches the project URL
- Make sure the function name matches exactly: `send-booking-notification`
- Check Supabase function logs for any runtime errors

## Environment Variables Needed in Supabase

The Edge Function automatically uses these from Supabase environment:
- `SUPABASE_URL` (automatically provided)
- `SUPABASE_SERVICE_ROLE_KEY` (automatically provided)
- `VAPID_PRIVATE_KEY` (you need to add this in Step 2)

## Database Requirements

The function expects a `push_subscriptions` table in your Supabase database with these columns:
- `endpoint` (text, primary key)
- `auth_key` (text)
- `p256dh_key` (text)
- `user_phone` (text)
- `created_at` (timestamp)

If this table doesn't exist, run this SQL in Supabase:

```sql
CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  auth_key TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  user_phone TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_phone ON push_subscriptions(user_phone);
```

## Questions?

If you need help:
1. Check the Supabase documentation: https://supabase.com/docs/guides/functions/deploy
2. Share any error messages from the console or Supabase logs
3. Make sure all environment variables are correctly set
