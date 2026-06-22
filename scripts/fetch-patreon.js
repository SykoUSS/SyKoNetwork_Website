/**
 * Patreon Data Fetcher for SyKoNetwork Website
 *
 * Fetches public posts from the Patreon API v2 at build time.
 * Falls back to sitemap scraping if the API is unavailable.
 * Keeps cached data if both methods fail.
 *
 * Usage: node scripts/fetch-patreon.js
 * Requires: PATREON_ACCESS_TOKEN environment variable (for API method)
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../src/data/patreon-posts.json');
const IMAGES_DIR = resolve(__dirname, '../public/images/patreon');

// Load .env file if it exists
const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
const CAMPAIGN_ID = '5461862';
const PATREON_URL = 'https://www.patreon.com/SyKoSoFi';

// ── Helpers ──

function stripHtml(html) {
  return html?.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim() ?? '';
}

function log(message) {
  console.log(`[patreon-fetch] ${message}`);
}

function warn(message) {
  console.warn(`[patreon-fetch] ⚠ ${message}`);
}

function error(message) {
  console.error(`[patreon-fetch] ✗ ${message}`);
}

// ── Image Extraction & Download ──

/**
 * Extract the first image URL from post HTML content.
 * Prioritizes Patreon CDN images, then any other image URLs.
 */
function extractFirstImageUrl(html) {
  if (!html) return null;

  // Match <img src="..."> tags
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  const images = [];

  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    // Decode HTML entities
    const decoded = src
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    images.push(decoded);
  }

  // Prefer Patreon CDN images (higher quality, more reliable)
  const patreonImage = images.find(img => img.includes('patreonusercontent.com'));
  if (patreonImage) return patreonImage;

  // Fall back to any image
  return images[0] ?? null;
}

/**
 * Download an image and save it locally.
 * Returns the local path relative to /public, or null on failure.
 */
async function downloadImage(url, postId) {
  if (!url) return null;

  // Skip YouTube thumbnails — they're not useful as card backgrounds
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
      warn(`Failed to download image for post ${postId}: ${response.status}`);
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

    log(`  Downloaded image for post ${postId} → /images/patreon/${filename}`);
    return `/images/patreon/${filename}`;
  } catch (err) {
    warn(`Error downloading image for post ${postId}: ${err.message}`);
    return null;
  }
}

// ── Method 1: Patreon API v2 ──

async function fetchViaApi(token) {
  log('Attempting Patreon API v2 fetch...');

  const allPosts = [];
  let nextCursor = null;
  let pageCount = 0;

  try {
    do {
      pageCount++;
      const params = new URLSearchParams({
        'fields[post]': 'title,content,published_at,url,is_public,is_paid,embed_data,embed_url',
        'page[count]': '50',
      });
      if (nextCursor) {
        params.set('page[cursor]', nextCursor);
      }

      const url = `https://www.patreon.com/api/oauth2/v2/campaigns/${CAMPAIGN_ID}/posts?${params.toString()}`;

      log(`Fetching page ${pageCount}...`);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'SyKoNetwork-Website/1.0 (build-time fetcher)',
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        error(`API returned ${response.status}: ${response.statusText}`);
        error(`Response body: ${body.substring(0, 500)}`);
        if (response.status === 401) {
          error('Token is invalid or expired. Generate a new Creator\'s Access Token at:');
          error('  https://www.patreon.com/portal/registration/register-clients');
          error('  Then update PATREON_ACCESS_TOKEN in .env');
        }
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();

      if (!json.data || !Array.isArray(json.data)) {
        warn(`Unexpected API response structure on page ${pageCount}`);
        break;
      }

      for (const post of json.data) {
        const attrs = post.attributes ?? {};
        // Extract thumbnail from embed_data if available
        let thumbnailUrl = null;
        if (attrs.embed_data?.thumbnail_url) {
          thumbnailUrl = attrs.embed_data.thumbnail_url;
        } else if (attrs.embed_data?.url) {
          // Some embeds have a direct image URL
          thumbnailUrl = attrs.embed_data.url;
        }

        // Extract first image from content HTML for card backgrounds
        const contentImageUrl = extractFirstImageUrl(attrs.content ?? '');

        allPosts.push({
          id: post.id,
          title: attrs.title ?? 'Untitled Post',
          content: attrs.content ?? '',
          published_at: attrs.published_at ?? null,
          url: (attrs.url && attrs.url.startsWith('http')) ? attrs.url : `${PATREON_URL}/posts/${post.id}`,
          is_public: attrs.is_public ?? false,
          thumbnail_url: thumbnailUrl,
          image_url: contentImageUrl ?? thumbnailUrl ?? null,
        });
      }

      nextCursor = json.meta?.pagination?.cursors?.next ?? null;
      log(`Page ${pageCount}: got ${json.data.length} posts, total so far: ${allPosts.length}`);

    } while (nextCursor && pageCount < 20); // Safety limit: max 20 pages (1000 posts)

    log(`API fetch complete: ${allPosts.length} total posts retrieved`);

    // Sort newest first
    allPosts.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

    return allPosts;

  } catch (err) {
    error(`API fetch failed: ${err.message}`);
    return null;
  }
}

// ── Method 2: Sitemap Scraping ──

async function fetchViaSitemap() {
  log('Attempting sitemap scraping fallback...');

  try {
    // Try the public posts page first (more reliable than sitemap)
    const posts = [];

    // Method A: Scrape the public posts page
    const postsUrl = `${PATREON_URL}/posts`;
    log(`Fetching posts page: ${postsUrl}`);
    const postsResponse = await fetch(postsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SyKoNetwork-Website/1.0)',
        'Accept': 'text/html',
      },
    });

    if (postsResponse.ok) {
      const html = await postsResponse.text();

      // Try to extract post data from Patreon's embedded JSON
      // Patreon embeds initial state in a <script> tag with JSON data
      const jsonMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (jsonMatch) {
        try {
          const jsonData = JSON.parse(jsonMatch[1]);
          // Navigate the Next.js data structure for posts
          const campaignPosts = jsonData?.props?.pageProps?.postAttachments
            ?? jsonData?.props?.pageProps?.campaignPosts
            ?? jsonData?.props?.pageProps?.posts;
          if (Array.isArray(campaignPosts)) {
            for (const post of campaignPosts) {
              const attrs = post.attributes ?? post ?? {};
              const sitemapContentImage = extractFirstImageUrl(attrs.content ?? attrs.body ?? '');
              posts.push({
                id: String(post.id ?? attrs.id ?? ''),
                title: attrs.title ?? attrs.post_title ?? 'Untitled Post',
                content: attrs.content ?? attrs.body ?? '',
                published_at: attrs.published_at ?? attrs.created_at ?? null,
                url: attrs.url ?? attrs.post_url ?? `${PATREON_URL}/posts/${post.id ?? attrs.id}`,
                is_public: attrs.is_public ?? attrs.public ?? false,
                thumbnail_url: attrs.embed_data?.thumbnail_url ?? attrs.thumbnail_url ?? attrs.image ?? null,
                image_url: sitemapContentImage ?? attrs.embed_data?.thumbnail_url ?? attrs.thumbnail_url ?? attrs.image ?? null,
              });
            }
          }
        } catch (e) {
          warn(`Failed to parse __NEXT_DATA__: ${e.message}`);
        }
      }

      // Also try extracting from Patreon's inline data
      const inlineMatch = html.match(/window\.patreon\s*=\s*({[\s\S]*?});/);
      if (inlineMatch && posts.length === 0) {
        try {
          const inlineData = JSON.parse(inlineMatch[1]);
          const campaignData = inlineData?.campaignInclude ?? inlineData?.campaign ?? {};
          const relatedPosts = Object.values(campaignData?.post ?? {});
          for (const post of relatedPosts) {
            const inlineContentImage = extractFirstImageUrl(post.content ?? post.body ?? '');
            posts.push({
              id: String(post.id ?? ''),
              title: post.title ?? post.post_title ?? 'Untitled Post',
              content: post.content ?? post.body ?? '',
              published_at: post.published_at ?? post.created_at ?? null,
              url: post.url ?? post.post_url ?? `${PATREON_URL}/posts/${post.id}`,
              is_public: post.is_public ?? post.public ?? false,
              thumbnail_url: post.thumbnail_url ?? post.image ?? null,
              image_url: inlineContentImage ?? post.thumbnail_url ?? post.image ?? null,
            });
          }
        } catch (e) {
          warn(`Failed to parse inline Patreon data: ${e.message}`);
        }
      }

      // Fallback: extract post links from HTML
      if (posts.length === 0) {
        const linkPattern = /href="(https:\/\/www\.patreon\.com\/SyKoSoFi\/posts\/[^"\s]+)"/g;
        const titlePattern = /<a[^>]*href="https:\/\/www\.patreon\.com\/SyKoSoFi\/posts\/[^"\s]+"[^>]*>([^<]+)<\/a>/g;
        const foundUrls = new Set();
        let linkMatch;
        while ((linkMatch = linkPattern.exec(html)) !== null) {
          foundUrls.add(linkMatch[1]);
        }

        for (const url of foundUrls) {
          const urlParts = url.split('/');
          const slug = urlParts[urlParts.length - 1] ?? '';
          const idMatch = slug.match(/-(\d+)$/);
          const id = idMatch ? idMatch[1] : slug;
          posts.push({
            id,
            title: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            content: '',
            published_at: null,
            url,
            is_public: true,
            thumbnail_url: null,
            image_url: null,
          });
        }
      }
    } else {
      warn(`Posts page returned ${postsResponse.status}`);
    }

    // Method B: Try sitemap.xml (more structured)
    if (posts.length === 0) {
      log('Posts page yielded no results, trying sitemap.xml...');
      const sitemapResponse = await fetch(`${PATREON_URL}/sitemap.xml`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SyKoNetwork-Website/1.0)',
        },
      });

      if (sitemapResponse.ok) {
        const xml = await sitemapResponse.text();
        // Parse XML sitemap for post URLs
        const urlPattern = /<loc>(https:\/\/www\.patreon\.com\/SyKoSoFi\/posts\/[^<]+)<\/loc>/g;
        let match;
        while ((match = urlPattern.exec(xml)) !== null) {
          const url = match[1];
          const urlParts = url.split('/');
          const slug = urlParts[urlParts.length - 1] ?? '';
          const idMatch = slug.match(/-(\d+)$/);
          const id = idMatch ? idMatch[1] : slug;
          posts.push({
            id,
            title: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            content: '',
            published_at: null,
            url,
            is_public: true,
            thumbnail_url: null,
            image_url: null,
          });
        }
      } else {
        warn(`Sitemap.xml returned ${sitemapResponse.status}`);
      }
    }

    // Method C: Try the original sitemap page
    if (posts.length === 0) {
      log('Trying sitemap page fallback...');
      const response = await fetch(`${PATREON_URL}/sitemap`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SyKoNetwork-Website/1.0)',
        },
      });

      if (response.ok) {
        const html = await response.text();
        const sections = html.split(/Posts from (\d{4})/g);

        for (let i = 1; i < sections.length; i += 2) {
          const year = sections[i];
          const content = sections[i + 1] ?? '';

          // Match markdown-style links: [Title](URL)
          const linkPattern = /\[([^\]]+)\]\((https:\/\/www\.patreon\.com\/SyKoSoFi\/posts\/[^)]+)\)/g;
          let match;

          while ((match = linkPattern.exec(content)) !== null) {
            const title = match[1];
            const url = match[2];
            const urlParts = url.split('/');
            const lastSegment = urlParts[urlParts.length - 1] ?? '';
            const idMatch = lastSegment.match(/-(\d+)$/);
            const id = idMatch ? idMatch[1] : lastSegment;

            // Try to find a date near the link
            const dateMatch = content.substring(Math.max(0, match.index - 50), match.index).match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/);
            const monthMap = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
            let publishedAt = null;
            if (dateMatch) {
              const monthNum = monthMap[dateMatch[1]] ?? '01';
              const dayStr = dateMatch[2].padStart(2, '0');
              publishedAt = `${year}-${monthNum}-${dayStr}T00:00:00+00:00`;
            }

            posts.push({
              id,
              title,
              content: '',
              published_at: publishedAt,
              url,
              is_public: false,
              thumbnail_url: null,
              image_url: null,
            });
          }
        }
      }
    }

    // Sort newest first
    posts.sort((a, b) => {
      const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
      const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
      return dateB - dateA;
    });

    // Deduplicate by ID
    const seen = new Set();
    const unique = posts.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    log(`Sitemap scrape complete: ${unique.length} posts found`);
    return unique.length > 0 ? unique : null;

  } catch (err) {
    error(`Sitemap scraping failed: ${err.message}`);
    return null;
  }
}

// ── Main ──

async function main() {
  log('Starting Patreon data fetch...');
  log(`Output: ${OUTPUT_PATH}`);

  let posts = null;

  // Try API first if token is available
  const accessToken = process.env.PATREON_ACCESS_TOKEN;

  if (accessToken) {
    log('PATREON_ACCESS_TOKEN found, trying API...');
    posts = await fetchViaApi(accessToken);
  } else {
    warn('No PATREON_ACCESS_TOKEN set. Skipping API method.');
  }

  // Fallback to sitemap
  if (!posts) {
    posts = await fetchViaSitemap();
  }

  // Ultimate fallback: keep cached data
  if (!posts || posts.length === 0) {
    warn('Both fetch methods failed or returned no posts.');

    if (existsSync(OUTPUT_PATH)) {
      const cached = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
      log(`Keeping existing cached data (${cached.length} posts).`);
    } else {
      warn('No cached data exists. Writing empty array.');
      writeFileSync(OUTPUT_PATH, JSON.stringify([], null, 2), 'utf-8');
    }
    // Exit successfully so the build continues
    process.exit(0);
  }

  // Download images for card backgrounds
  log('Downloading post images...');
  mkdirSync(IMAGES_DIR, { recursive: true });

  for (const post of posts) {
    if (post.image_url) {
      const localPath = await downloadImage(post.image_url, post.id);
      if (localPath) {
        post.image_url = localPath;
      } else {
        // Keep the original URL as fallback (may not work due to referrer restrictions)
        // but prefer null for clean rendering
        post.image_url = null;
      }
    }
  }

  const imageCount = posts.filter((p) => p.image_url).length;
  log(`Downloaded ${imageCount}/${posts.length} post images`);

  // Write the fetched data
  writeFileSync(OUTPUT_PATH, JSON.stringify(posts, null, 2), 'utf-8');
  log(`Success! Wrote ${posts.length} posts to ${OUTPUT_PATH}`);

  // Log summary
  const publicCount = posts.filter((p) => p.is_public).length;
  const lockedCount = posts.filter((p) => !p.is_public).length;
  log(`  Public posts: ${publicCount}`);
  log(`  Locked posts: ${lockedCount}`);
}

main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
  // Don't fail the build
  process.exit(0);
});
