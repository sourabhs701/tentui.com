import { SITE_INFO } from "@/config/site";
import { createRssResponse } from "@/lib/rss";
import { absoluteUrl, getBlockRssItems } from "@/lib/rss-feeds";

export const dynamic = "force-static";
export const revalidate = false;

export function GET() {
	return createRssResponse({
		title: `Blocks | ${SITE_INFO.name}`,
		description: "Beautifully designed, production-ready React blocks.",
		url: absoluteUrl("/blocks"),
		selfUrl: absoluteUrl("/blocks/rss"),
		items: getBlockRssItems(),
	});
}
