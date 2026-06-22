#!/usr/bin/env node
/**
 * Copies Godot HTML5 export files into the Astro public directory.
 *
 * Usage:
 *   node scripts/copy-game.js [source-dir]
 *
 * If no source-dir is provided, defaults to:
 *   /home/sofia/hex-tac-toe_v2/export/web/
 *
 * The files are copied to: public/hex-tac-toe/
 */

import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SOURCE_DIR = process.argv[2] || '/home/sofia/hex-tac-toe_v2/export/web/';
const DEST_DIR = resolve(import.meta.dirname, '..', 'public', 'hex-tac-toe');

console.log(`🎮 Copying Godot Web export...`);
console.log(`   Source: ${SOURCE_DIR}`);
console.log(`   Destination: ${DEST_DIR}`);

if (!existsSync(SOURCE_DIR)) {
  console.error(`❌ Source directory does not exist: ${SOURCE_DIR}`);
  console.error(`   Make sure you've exported the Godot project to HTML5 first.`);
  console.error(`   In Godot: Project → Export → Add "Web" preset → Export Project`);
  console.error(`   Export to: ${SOURCE_DIR}`);
  process.exit(1);
}

// Ensure destination exists
mkdirSync(DEST_DIR, { recursive: true });

// Copy all files from the export directory
cpSync(SOURCE_DIR, DEST_DIR, { recursive: true });

// Rename index.html → game.html to avoid conflict with Astro's generated /hex-tac-toe/index.html
// Astro generates /hex-tac-toe/index.html from src/pages/hex-tac-toe.astro, which would
// overwrite the Godot game's index.html during build.
const godotHtml = join(DEST_DIR, 'index.html');
const renamedHtml = join(DEST_DIR, 'game.html');
if (existsSync(godotHtml)) {
  renameSync(godotHtml, renamedHtml);
  console.log(`   Renamed: index.html → game.html (avoids Astro route conflict)`);
}

// Update references inside game.html to use game-prefixed service worker and manifest
const gameHtml = join(DEST_DIR, 'game.html');
if (existsSync(gameHtml)) {
  let content = readFileSync(gameHtml, 'utf8');
  content = content.replace('index.manifest.json', 'game.manifest.json');
  content = content.replace('index.service.worker.js', 'game.service.worker.js');
  writeFileSync(gameHtml, content);
  console.log(`   Updated game.html references (manifest + service worker)`);
}

// Rename and update the manifest to point to game.html
const srcManifest = join(DEST_DIR, 'index.manifest.json');
const dstManifest = join(DEST_DIR, 'game.manifest.json');
if (existsSync(srcManifest)) {
  let content = readFileSync(srcManifest, 'utf8');
  content = content.replace('./index.html', './game.html');
  writeFileSync(dstManifest, content);
  console.log(`   Created: game.manifest.json (start_url → ./game.html)`);
}

// Rename and update the service worker to cache game.html instead of index.html
const srcSw = join(DEST_DIR, 'index.service.worker.js');
const dstSw = join(DEST_DIR, 'game.service.worker.js');
if (existsSync(dstSw)) {
  // Already exists (committed to repo), skip
} else if (existsSync(srcSw)) {
  let content = readFileSync(srcSw, 'utf8');
  content = content.replace('"index.html"', '"game.html"');
  writeFileSync(dstSw, content);
  console.log(`   Created: game.service.worker.js (caches game.html)`);
}

console.log(`✅ Game files copied successfully!`);