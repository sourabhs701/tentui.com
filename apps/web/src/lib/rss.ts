export type RssItem = {
	title: string;
	description: string;
	url: string;
	publishedAt: Date;
	category?: string;
};

type RssFeed = {
	title: string;
	description: string;
	url: string;
	selfUrl: string;
	items: RssItem[];
};

const RSS_CONTENT_TYPE = "application/rss+xml; charset=utf-8";

export function parseRssDate(value: unknown, itemName: string): Date {
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			throw new Error(`[rss] Invalid createdAt for "${itemName}".`);
		}

		return value;
	}

	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`[rss] Missing createdAt for "${itemName}".`);
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new Error(
			`[rss] Invalid createdAt for "${itemName}": ${JSON.stringify(value)}.`,
		);
	}

	return date;
}

export function renderRssFeed(feed: RssFeed): string {
	const items = [...feed.items].sort(compareRssItems);
	const lastBuildDate = items[0]?.publishedAt.toUTCString();
	const itemsXml = items.map(renderRssItem).join("\n");
	const lastBuildDateXml = lastBuildDate
		? `\n    <lastBuildDate>${lastBuildDate}</lastBuildDate>`
		: "";
	const itemsSection = itemsXml ? `\n${itemsXml}` : "";

	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feed.title)}</title>
    <link>${escapeXml(feed.url)}</link>
    <description>${escapeXml(feed.description)}</description>
    <language>en</language>
    <atom:link href="${escapeXml(feed.selfUrl)}" rel="self" type="application/rss+xml" />${lastBuildDateXml}${itemsSection}
  </channel>
</rss>`;
}

export function createRssResponse(feed: RssFeed): Response {
	return new Response(renderRssFeed(feed), {
		headers: {
			"Content-Type": RSS_CONTENT_TYPE,
		},
	});
}

function compareRssItems(a: RssItem, b: RssItem): number {
	const dateDifference = b.publishedAt.getTime() - a.publishedAt.getTime();
	if (dateDifference !== 0) return dateDifference;

	return a.title.localeCompare(b.title, "en", { sensitivity: "base" });
}

function renderRssItem(item: RssItem): string {
	const categoryXml = item.category
		? `\n      <category>${escapeXml(item.category)}</category>`
		: "";

	return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${item.publishedAt.toUTCString()}</pubDate>${categoryXml}
    </item>`;
}

function escapeXml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => {
		switch (character) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			default:
				return "&apos;";
		}
	});
}
