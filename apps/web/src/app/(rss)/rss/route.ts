import { SITE_INFO } from "@/config/site";
import { createRssResponse } from "@/lib/rss";
import {
	absoluteUrl,
	getBlockRssItems,
	getBlogRssItems,
	getComponentRssItems,
} from "@/lib/rss-feeds";

export const dynamic = "force-static";
export const revalidate = false;

export function GET() {
	return createRssResponse({
		title: `${SITE_INFO.name} updates`,
		description: "New components, blocks, and guides from TentUI.",
		url: SITE_INFO.url,
		selfUrl: absoluteUrl("/rss"),
		items: [
			...getComponentRssItems(),
			...getBlockRssItems(),
			...getBlogRssItems(),
		],
	});
}
