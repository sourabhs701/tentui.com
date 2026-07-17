import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

/**
 * Blocks/preview pages are fully prerendered (SSG). Serve them from Workers
 * Static Assets incremental cache — no R2/KV/DO revalidation stack required.
 *
 * Without this, OpenNext defaults to a dummy cache: prerender misses →
 * revalidation → Internal NoFallbackError (404 in the preview iframe).
 *
 * @see https://opennext.js.org/cloudflare/caching#ssg-site
 */
export default defineCloudflareConfig({
	incrementalCache: staticAssetsIncrementalCache,
	// Skip loading the full Next server when the incremental cache hits.
	enableCacheInterception: true,
});
