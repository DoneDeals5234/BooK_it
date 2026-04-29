#!/usr/bin/env node

/**
 * Script to auto-increment the app version in package.json
 * Increments the patch version (e.g., 0.0.0 -> 0.0.1 -> 0.0.2)
 */

import fs from 'fs';
import path from 'path';

const packageJsonPath = path.join(process.cwd(), 'package.json');

try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const currentVersion = packageJson.version;

  // Parse semantic versioning
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  // Increment patch version
  const newVersion = `${major}.${minor}.${patch + 1}`;

  // Update package.json
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  console.log(`📦 Version incremented: ${currentVersion} → ${newVersion}`);
} catch (error) {
  console.error('❌ Error incrementing version:', error.message);
  process.exit(1);
}
