import type { MetadataRoute } from "next";

import { SITE_INFO } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
			// /preview/ stays crawlable so the noindex tag on previews is seen
			// and the iframes on /blocks and /components pages render.
			disallow: ["/workbench/"],
		},
		sitemap: `${SITE_INFO.url}/sitemap.xml`,
	};
}
