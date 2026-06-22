import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// Read the PNG favicon
const pngBuffer = readFileSync(join(publicDir, 'favicon.png'));
const base64Png = pngBuffer.toString('base64');

// Read SVG accessibility metadata from environment variables (ARG fragment #8)
// Falls back to harmless defaults if not set (for builds without secrets)
const svgTitle = process.env.PUBLIC_ASSET_META_TITLE || 'Site favicon';
const svgDesc = process.env.PUBLIC_ASSET_META_DESC || 'SyKoNetwork icon';

// Create a self-contained SVG that embeds the PNG as a data URI
// This ensures the favicon renders exactly like the PNG in all browsers
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
  <title>${svgTitle}</title>
  <desc>${svgDesc}</desc>
  <image href="data:image/png;base64,${base64Png}" width="150" height="150"/>
</svg>`;

// Write the SVG favicon
writeFileSync(join(publicDir, 'favicon.svg'), svgContent);
console.log(`✅ Generated favicon.svg (${(svgContent.length / 1024).toFixed(1)} KB) from favicon.png (${(pngBuffer.length / 1024).toFixed(1)} KB)`);
console.log(`   SVG metadata: title="${svgTitle}", desc="${svgDesc}"`);
console.log('   The SVG embeds the PNG as a base64 data URI for maximum browser compatibility.');