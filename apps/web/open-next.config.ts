import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

/**
 * The shared GitHub star count uses time-based revalidation. OpenNext requires
 * a writable incremental cache and queue for ISR; static assets are read-only.
 *
 * @see https://opennext.js.org/cloudflare/caching#small-site-using-revalidation
 */
export default defineCloudflareConfig({
	incrementalCache: r2IncrementalCache,
	queue: doQueue,
	// Skip loading the full Next server when the incremental cache hits.
	enableCacheInterception: true,
});
