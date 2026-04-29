#!/usr/bin/env node

/**
 * Script to sync the app version from package.json to Supabase app_updates table
 * Run this before building the app to ensure the database has the latest version
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

// Read package.json
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const appVersion = packageJson.version;

console.log(`📦 Syncing app version: ${appVersion}`);

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function syncVersion() {
  try {
    // Get current update record
    const { data: currentData, error: fetchError } = await supabase
      .from('app_updates')
      .select('*')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (currentData) {
      // Parse current version and increment latest to be one patch ahead
      const [major, minor, patch] = appVersion.split('.').map(Number);
      const latestVersion = `${major}.${minor}.${patch + 1}`;

      // Update both current and latest versions
      // Latest version is always one patch ahead for continuous update availability
      const { error: updateError } = await supabase
        .from('app_updates')
        .update({
          current_version: appVersion,
          latest_version: latestVersion
        })
        .eq('id', currentData.id);

      if (updateError) throw updateError;
      console.log(`✅ Version synced successfully: current=${appVersion}, latest=${latestVersion}`);
    } else {
      // Create new record if it doesn't exist
      const [major, minor, patch] = appVersion.split('.').map(Number);
      const latestVersion = `${major}.${minor}.${patch + 1}`;

      const { error: insertError } = await supabase
        .from('app_updates')
        .insert({
          current_version: appVersion,
          latest_version: latestVersion,
          update_enabled: false,
          update_message: 'New version available. Please update to get the latest features and improvements.',
        });

      if (insertError) throw insertError;
      console.log(`✅ Initial version record created: current=${appVersion}, latest=${latestVersion}`);
    }
  } catch (error) {
    console.warn('⚠️  Warning: Could not sync version to Supabase:', error.message);
    console.warn('Continuing with build. Version sync is optional.');
  }
}

syncVersion();
