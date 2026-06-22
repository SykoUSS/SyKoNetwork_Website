import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // For a user/org site (e.g. sykosofi.github.io), use base: '/'
  // For a project site (e.g. username.github.io/repo-name), use base: '/repo-name'
  site: 'https://syko.network',
  base: '/',

  integrations: [sitemap()],

  vite: {
    plugins: [
      tailwindcss(),
      // Inject COOP/COEP headers for Godot Web exports (required for SharedArrayBuffer)
      // Also add CORP headers and correct MIME types for Firefox compatibility
      {
        name: 'godot-coop-coep-headers',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url && req.url.startsWith('/hex-tac-toe/')) {
              res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
              res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
            }
            // Ensure .wasm files have the correct MIME type (required by Firefox)
            if (req.url && req.url.endsWith('.wasm')) {
              res.setHeader('Content-Type', 'application/wasm');
              res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            }
            // Allow .pck and .js files under COEP
            if (req.url && (req.url.endsWith('.pck') || req.url.endsWith('.js'))) {
              res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            }
            next();
          });
        },
      },
    ],
  },

  build: {
    inlineStylesheets: 'never',
  },
});
