/**
 * Firebase Cloud Functions - Mostly empty
 * Shop status tracking is now handled by:
 * - Supabase Edge Functions: shop-heartbeat endpoint
 * - Supabase pg_cron: Automated status checking every minute
 *
 * See:
 * - supabase/functions/shop-heartbeat/index.ts
 * - supabase/migrations/004_add_pg_cron_status_check.sql
 */

const { setGlobalOptions } = require("firebase-functions");
const logger = require("firebase-functions/logger");

setGlobalOptions({ maxInstances: 10 });

// Firebase functions removed - using Supabase Edge Functions and pg_cron for shop status tracking
// Reminders are processed via Supabase pg_cron scheduled job
