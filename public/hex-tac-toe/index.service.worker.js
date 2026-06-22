// This service worker is required to expose an exported Godot project as a
// Progressive Web App. It provides an offline fallback page telling the user
// that they need an Internet connection to run the project if desired.
// Incrementing CACHE_VERSION will kick off the install event and force
// previously cached resources to be updated from the network.
/** @type {string} */
const CACHE_VERSION = '1781713101|4591457154';
/** @type {string} */
const CACHE_PREFIX = 'Hex-Tac-Toe-sw-cache-';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
/** @type {string} */
const OFFLINE_URL = 'index.offline.html';
/** @type {boolean} */
const ENSURE_CROSSORIGIN_ISOLATION_HEADERS = true;
// Files that will be cached on load.
/** @type {string[]} */
const CACHED_FILES = ["index.html","index.js","index.offline.html","index.icon.png","index.apple-touch-icon.png","index.audio.worklet.js","index.audio.position.worklet.js"];
// Files that we might not want the user to preload, and will only be cached on first load.
/** @type {string[]} */
const CACHEABLE_FILES = ["index.wasm","index.pck"];
const FULL_CACHE = CACHED_FILES.concat(CACHEABLE_FILES);

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHED_FILES)));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(caches.keys().then(
		function (keys) {
			// Remove old caches.
			return Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
		}
	).then(function () {
		// Enable navigation preload if available.
		return ('navigationPreload' in self.registration) ? self.registration.navigationPreload.enable() : Promise.resolve();
	}));
});

/**
 * Ensures that the response has the correct COEP/COOP headers
 * Also adds Cross-Origin-Resource-Policy and correct MIME type for
 * .wasm/.pck/.js files, which is required by Firefox under COEP.
 * @param {Response} response
 * @param {string} url
 * @returns {Response}
 */
function ensureCrossOriginIsolationHeaders(response, url) {
	const headers = new Headers(response.headers);

	// Always set COOP/COEP for cross-origin isolation
	headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
	headers.set('Cross-Origin-Opener-Policy', 'same-origin');

	// Add CORP header for game assets (required under COEP for Firefox)
	if (url.endsWith('.wasm') || url.endsWith('.pck') || url.endsWith('.js')) {
		headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
	}

	// Ensure .wasm files have the correct MIME type (required by Firefox for instantiateStreaming)
	if (url.endsWith('.wasm')) {
		headers.set('Content-Type', 'application/wasm');
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: headers,
	});
}

/**
 * Calls fetch and cache the result if it is cacheable
 * @param {FetchEvent} event
 * @param {Cache} cache
 * @param {boolean} isCacheable
 * @returns {Response}
 */
async function fetchAndCache(event, cache, isCacheable) {
	// Use the preloaded response, if it's there
	/** @type { Response } */
	let response = await event.preloadResponse;
	if (response == null) {
		// Or, go over network.
		response = await self.fetch(event.request);
	}

	if (ENSURE_CROSSORIGIN_ISOLATION_HEADERS) {
		response = ensureCrossOriginIsolationHeaders(response, event.request.url);
	}

	if (isCacheable) {
		// And update the cache
		cache.put(event.request, response.clone());
	}

	return response;
}

self.addEventListener(
	'fetch',
	/**
	 * Triggered on fetch
	 * @param {FetchEvent} event
	 */
	(event) => {
		const isNavigate = event.request.mode === 'navigate';
		const url = event.request.url || '';
		const referrer = event.request.referrer || '';
		const base = referrer.slice(0, referrer.lastIndexOf('/') + 1);
		const local = url.startsWith(base) ? url.replace(base, '') : '';
		const isCacheable = FULL_CACHE.some((v) => v === local) || (base === referrer && base.endsWith(CACHED_FILES[0]));
		if (isNavigate || isCacheable) {
			event.respondWith((async () => {
				// Try to use cache first
				const cache = await caches.open(CACHE_NAME);
				if (isNavigate) {
					// Check if we have full cache during HTML page request.
					/** @type {Response[]} */
					const fullCache = await Promise.all(FULL_CACHE.map((name) => cache.match(name)));
					const missing = fullCache.some((v) => v === undefined);
					if (missing) {
						try {
							// Try network if some cached file is missing (so we can display offline page in case).
							const response = await fetchAndCache(event, cache, isCacheable);
							return response;
						} catch (e) {
							// And return the hopefully always cached offline page in case of network failure.
							console.error('Network error: ', e); // eslint-disable-line no-console
							return caches.match(OFFLINE_URL);
						}
					}
				}
				let cached = await cache.match(event.request);
				if (cached != null) {
					if (ENSURE_CROSSORIGIN_ISOLATION_HEADERS) {
						cached = ensureCrossOriginIsolationHeaders(cached, event.request.url);
					}
					return cached;
				}
				// Try network if don't have it in cache.
				const response = await fetchAndCache(event, cache, isCacheable);
				return response;
			})());
		} else if (ENSURE_CROSSORIGIN_ISOLATION_HEADERS) {
			event.respondWith((async () => {
				let response = await fetch(event.request);
				response = ensureCrossOriginIsolationHeaders(response, event.request.url);
				return response;
			})());
		}
	}
);

self.addEventListener('message', (event) => {
	// No cross origin
	if (event.origin !== self.origin) {
		return;
	}
	const id = event.source.id || '';
	const msg = event.data || '';
	// Ensure it's one of our clients.
	self.clients.get(id).then(function (client) {
		if (!client) {
			return; // Not a valid client.
		}
		if (msg === 'claim') {
			self.skipWaiting().then(() => self.clients.claim());
		} else if (msg === 'clear') {
			caches.delete(CACHE_NAME);
		} else if (msg === 'update') {
			self.skipWaiting().then(() => self.clients.claim()).then(() => self.clients.matchAll()).then((all) => all.forEach((c) => c.navigate(c.url)));
		}
	});
});

