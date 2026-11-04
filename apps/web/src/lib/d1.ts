import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getDb() {
	return (getCloudflareContext().env as { DB?: D1Database }).DB ?? null;
}
