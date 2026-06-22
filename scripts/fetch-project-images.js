/**
 * Download project thumbnails from CurseForge.
 * 
 * Usage: node scripts/fetch-project-images.js
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = resolve(__dirname, '../public/images/project');

const PROJECTS = [
  {
    id: 'ender-elevators',
    url: 'https://media.forgecdn.net/avatars/thumbnails/1095/885/256/256/638641175353599459.png',
    filename: 'ender-elevators.png',
  },
  {
    id: 'dungeon-expanse',
    url: 'https://media.forgecdn.net/avatars/thumbnails/1095/875/256/256/638641162007040021.png',
    filename: 'dungeon-expanse.png',
  },
  {
    id: 'the-little-things',
    url: 'https://media.forgecdn.net/avatars/thumbnails/1114/671/256/256/638668146313429705.png',
    filename: 'the-little-things.png',
  },
  {
    id: 'return-anchors',
    url: 'https://media.forgecdn.net/avatars/thumbnails/1138/983/256/256/638701712209979341.png',
    filename: 'return-anchors.png',
  },
  {
    id: 'permanence',
    url: 'https://media.forgecdn.net/avatars/thumbnails/1134/822/256/256/638695794224364438.png',
    filename: 'permanence.png',
  },
  {
    id: 'natural-trees',
    url: 'https://media.forgecdn.net/avatars/thumbnails/1114/668/256/256/638668140178169032.png',
    filename: 'natural-trees.png',
  },
];

async function downloadWithFetch(url, filepath) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SyKoNetwork-Website/1.0)',
      'Accept': 'image/*',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  writeFileSync(filepath, Buffer.from(arrayBuffer));
  return arrayBuffer.byteLength;
}

function downloadWithCurl(url, filepath) {
  execSync(`curl -L -s -o "${filepath}" -H "User-Agent: Mozilla/5.0 (compatible; SyKoNetwork-Website/1.0)" "${url}"`, {
    encoding: 'utf-8',
  });
  if (!existsSync(filepath)) {
    throw new Error('curl did not create file');
  }
  const stats = require('fs').statSync(filepath);
  return stats.size;
}

async function main() {
  console.log('[fetch-project-images] Starting...');
  mkdirSync(IMAGES_DIR, { recursive: true });

  for (const project of PROJECTS) {
    const filepath = resolve(IMAGES_DIR, project.filename);

    // Skip if already downloaded
    if (existsSync(filepath)) {
      console.log(`  → ${project.id} already exists, skipping`);
      continue;
    }

    try {
      console.log(`  Downloading ${project.id}...`);
      const size = await downloadWithFetch(project.url, filepath);
      console.log(`  ✓ Downloaded ${project.id} → /images/project/${project.filename} (${size} bytes)`);
    } catch (fetchErr) {
      console.warn(`  ⚠ fetch failed for ${project.id}: ${fetchErr.message}`);
      console.log(`  → Trying curl fallback...`);
      try {
        const size = downloadWithCurl(project.url, filepath);
        console.log(`  ✓ Downloaded ${project.id} via curl → /images/project/${project.filename} (${size} bytes)`);
      } catch (curlErr) {
        console.warn(`  ✗ curl also failed for ${project.id}: ${curlErr.message}`);
        console.log(`  → Download manually: ${project.url}`);
        console.log(`    Save to: ${filepath}`);
      }
    }
  }

  console.log('[fetch-project-images] Done!');
}

main().catch((err) => {
  console.error(`[fetch-project-images] ✗ Unexpected error: ${err.message}`);
  process.exit(0);
});