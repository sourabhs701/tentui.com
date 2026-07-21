import { SITE_INFO } from "@/config/site";
import { createRssResponse } from "@/lib/rss";
import { absoluteUrl, getComponentRssItems } from "@/lib/rss-feeds";

export const dynamic = "force-static";
export const revalidate = false;

export function GET() {
	return createRssResponse({
		title: `Components | ${SITE_INFO.name}`,
		description:
			"Beautiful, open-source React components for modern web applications.",
		url: absoluteUrl("/components"),
		selfUrl: absoluteUrl("/components/rss"),
		items: getComponentRssItems(),
	});
}
