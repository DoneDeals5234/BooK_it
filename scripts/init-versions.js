#!/usr/bin/env node

/**
 * Script to initialize app versions in the database
 * Sets current_version to 0.0.1 and latest_version to 0.0.2
 * Run this once to set initial values
 */

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

const supabase = createClient(supabaseUrl, supabaseKey);

async function initVersions() {
  try {
    // Get current update record
    const { data: currentData } = await supabase
      .from('app_updates')
      .select('*')
      .single();

    if (currentData) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('app_updates')
        .update({
          current_version: '0.0.1',
          latest_version: '0.0.2'
        })
        .eq('id', currentData.id);

      if (updateError) throw updateError;
      console.log(`✅ Versions initialized: current=0.0.1, latest=0.0.2`);
    } else {
      // Create new record
      const { error: insertError } = await supabase
        .from('app_updates')
        .insert({
          current_version: '0.0.1',
          latest_version: '0.0.2',
          update_enabled: false,
          update_message: 'New version available. Please update to get the latest features and improvements.',
        });

      if (insertError) throw insertError;
      console.log(`✅ Initial record created: current=0.0.1, latest=0.0.2`);
    }
  } catch (error) {
    console.error('❌ Error initializing versions:', error.message);
    process.exit(1);
  }
}

initVersions();
