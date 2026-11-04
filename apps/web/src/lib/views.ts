import { getDb } from "@/lib/d1";

/** Headless browsers, audits and crawlers that run JS. */
const botUserAgent = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed/i;

export function isBotRequest(userAgent: string | null) {
	return !userAgent || botUserAgent.test(userAgent);
}

// The client only POSTs once per browser session; this also collapses
// refresh spam from one client. Best effort: kept per Worker isolate.
const dedupeWindowMs = 30 * 60_000;
const recentViews = new Map<string, number>();

export function isRepeatView(slug: string, headers: Headers) {
	const client =
		headers.get("cf-connecting-ip") ??
		headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		"local";
	const key = `${client}|${headers.get("user-agent")}|${slug}`;
	const now = Date.now();

	for (const [entry, at] of recentViews) {
		if (now - at > dedupeWindowMs) recentViews.delete(entry);
	}

	const isRepeat = recentViews.has(key);
	recentViews.set(key, now);
	return isRepeat;
}

export async function incrementViews(slug: string) {
	const db = getDb();
	if (!db) return 0;

	const row = await db
		.prepare(
			`INSERT INTO component_views (slug, count, updated_at)
			VALUES (?1, 1, ?2)
			ON CONFLICT(slug) DO UPDATE SET count = count + 1, updated_at = ?2
			RETURNING count`,
		)
		.bind(slug, Date.now())
		.first<{ count: number }>();
	return row?.count ?? 0;
}

export async function getViews(slug: string) {
	const db = getDb();
	if (!db) return 0;

	const row = await db
		.prepare("SELECT count FROM component_views WHERE slug = ?1")
		.bind(slug)
		.first<{ count: number }>();
	return row?.count ?? 0;
}
