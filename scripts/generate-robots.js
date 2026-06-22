import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// Read the Disallow path from environment variable (ARG fragment #2)
// Falls back to a harmless default if not set (for builds without secrets)
const disallowPath = process.env.PUBLIC_ROBOTS_DISALLOW || '/restricted/';

const robotsContent = `User-agent: *
Allow: /
Disallow: ${disallowPath}

Sitemap: https://syko.network/sitemap-index.xml
`;

writeFileSync(join(publicDir, 'robots.txt'), robotsContent);
console.log(`✅ Generated robots.txt (Disallow: ${disallowPath})`);
