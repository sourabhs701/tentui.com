import { getDb } from "@/lib/d1";
import { isRegistrySlug } from "@/lib/registry-slugs";

const registryItemPath = /^\/r\/([a-z0-9-]+)\.json$/;

/** Slug of a registry item fetch (`/r/wheel-picker.json`), or null. */
export function getRegistryItemSlug(pathname: string) {
	const slug = pathname.match(registryItemPath)?.[1];
	if (!slug || !isRegistrySlug(slug)) return null;
	return slug;
}

/**
 * Browsers (people opening the JSON, crawlers, link previews) send a
 * `Mozilla/…` user agent; the shadcn CLI and MCP clients do not.
 */
export function isInstallRequest(userAgent: string | null) {
	return !userAgent?.startsWith("Mozilla/");
}

// `shadcn add` fetches the same item twice per install, back to back with
// identical headers. Collapse repeat fetches from one client within a short
// window so an install counts once. Best effort: kept per Worker isolate.
const dedupeWindowMs = 10_000;
const recentFetches = new Map<string, number>();

export function isRepeatFetch(slug: string, headers: Headers) {
	const client =
		headers.get("cf-connecting-ip") ??
		headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		"local";
	const key = `${client}|${headers.get("user-agent")}|${slug}`;
	const now = Date.now();

	for (const [entry, at] of recentFetches) {
		if (now - at > dedupeWindowMs) recentFetches.delete(entry);
	}

	const isRepeat = recentFetches.has(key);
	recentFetches.set(key, now);
	return isRepeat;
}

export async function incrementDownloads(slug: string) {
	const db = getDb();
	if (!db) return;

	await db
		.prepare(
			`INSERT INTO component_downloads (slug, count, updated_at)
			VALUES (?1, 1, ?2)
			ON CONFLICT(slug) DO UPDATE SET count = count + 1, updated_at = ?2`,
		)
		.bind(slug, Date.now())
		.run();
}

export async function getDownloads(slug: string) {
	const db = getDb();
	if (!db) return 0;

	const row = await db
		.prepare("SELECT count FROM component_downloads WHERE slug = ?1")
		.bind(slug)
		.first<{ count: number }>();
	return row?.count ?? 0;
}
