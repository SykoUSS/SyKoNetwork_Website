/**
 * Extract & download images from existing Patreon post data.
 *
 * Reads src/data/patreon-posts.json, finds the first <img> in each post's
 * HTML content, downloads it to public/images/patreon/, and writes the
 * local path back into the JSON as `image_url`.
 *
 * Usage: node scripts/extract-patreon-images.js
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, '../src/data/patreon-posts.json');
const IMAGES_DIR = resolve(__dirname, '../public/images/patreon');

function extractFirstImageUrl(html) {
  if (!html) return null;
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  const images = [];
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    images.push(src);
  }
  // Prefer Patreon CDN images
  const patreonImage = images.find(img => img.includes('patreonusercontent.com'));
  if (patreonImage) return patreonImage;
  return images[0] ?? null;
}

async function downloadImage(url, postId) {
  if (!url) return null;
  // Skip YouTube thumbnails
  if (url.includes('youtu.be') || url.includes('youtube.com') || url.includes('img.youtube.com')) {
    return null;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SyKoNetwork-Website/1.0 (build-time fetcher)',
      },
    });

    if (!response.ok) {
      console.warn(`  ⚠ Failed to download image for post ${postId}: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') ?? '';
    let ext = 'jpg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'webp';
    else if (contentType.includes('gif')) ext = 'gif';

    const filename = `post-${postId}.${ext}`;
    const filepath = resolve(IMAGES_DIR, filename);

    const arrayBuffer = await response.arrayBuffer();
    mkdirSync(IMAGES_DIR, { recursive: true });
    writeFileSync(filepath, Buffer.from(arrayBuffer));

    console.log(`  ✓ Downloaded image for post ${postId} → /images/patreon/${filename}`);
    return `/images/patreon/${filename}`;
  } catch (err) {
    console.warn(`  ⚠ Error downloading image for post ${postId}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('[extract-images] Starting image extraction...');

  if (!existsSync(DATA_PATH)) {
    console.error('[extract-images] ✗ patreon-posts.json not found');
    process.exit(1);
  }

  const posts = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  console.log(`[extract-images] Found ${posts.length} posts`);

  mkdirSync(IMAGES_DIR, { recursive: true });

  let downloaded = 0;
  let skipped = 0;

  for (const post of posts) {
    // If already has a local image_url, skip
    if (post.image_url && post.image_url.startsWith('/images/')) {
      console.log(`  → Post ${post.id} already has local image, skipping`);
      continue;
    }

    // Extract image URL from content
    const contentImageUrl = extractFirstImageUrl(post.content);

    // Also check thumbnail_url for usable images
    let imageUrl = contentImageUrl;
    if (!imageUrl && post.thumbnail_url) {
      // Use thumbnail if it's not a YouTube link
      const thumb = post.thumbnail_url;
      if (!thumb.includes('youtu.be') && !thumb.includes('youtube.com') && !thumb.includes('img.youtube.com')) {
        imageUrl = thumb;
      }
    }

    if (!imageUrl) {
      console.log(`  → Post ${post.id} "${post.title}" — no image found`);
      post.image_url = null;
      skipped++;
      continue;
    }

    console.log(`  → Post ${post.id} "${post.title}" — downloading...`);
    const localPath = await downloadImage(imageUrl, post.id);
    if (localPath) {
      post.image_url = localPath;
      downloaded++;
    } else {
      post.image_url = null;
      skipped++;
    }
  }

  // Write updated JSON
  writeFileSync(DATA_PATH, JSON.stringify(posts, null, 2), 'utf-8');
  console.log(`\n[extract-images] Done! Downloaded: ${downloaded}, Skipped: ${skipped}`);
  console.log(`[extract-images] Updated ${DATA_PATH}`);
}

main().catch((err) => {
  console.error(`[extract-images] ✗ Unexpected error: ${err.message}`);
  process.exit(0);
});