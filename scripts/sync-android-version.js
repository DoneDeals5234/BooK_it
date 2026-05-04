#!/usr/bin/env node

/**
 * Script to sync version from package.json to Android build.gradle
 * This ensures CapacitorApp.getInfo() returns the correct version on Android.
 * Run this after incrementing the version (part of the build pipeline).
 */

import fs from 'fs';
import path from 'path';

const packageJsonPath = path.join(process.cwd(), 'package.json');
const buildGradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');

try {
  // 1. Read the current version from package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const version = packageJson.version; // e.g. "0.0.102"

  // 2. Compute versionCode from the version string
  // Convert "MAJOR.MINOR.PATCH" → integer: MAJOR*10000 + MINOR*100 + PATCH
  // e.g. "0.0.102" → 102, "1.2.5" → 10205
  const [major, minor, patch] = version.split('.').map(Number);
  const versionCode = (major * 10000) + (minor * 100) + patch;

  // 3. Read the build.gradle file
  if (!fs.existsSync(buildGradlePath)) {
    console.warn('⚠️  android/app/build.gradle not found. Skipping Android version sync.');
    console.warn('   Run "npx cap add android" first if you haven\'t set up Android yet.');
    process.exit(0);
  }

  let gradleContent = fs.readFileSync(buildGradlePath, 'utf-8');

  // 4. Replace versionCode and versionName
  const updatedContent = gradleContent
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);

  // 5. Write back
  fs.writeFileSync(buildGradlePath, updatedContent);

  console.log(`✅ Android version synced: versionName="${version}", versionCode=${versionCode}`);
} catch (error) {
  console.warn('⚠️  Warning: Could not sync Android version:', error.message);
  console.warn('   Continuing build. Android version sync is optional.');
  // Don't exit(1) - this is non-critical
}
