import type { MetadataRoute } from "next";

import { blockCategories } from "@/config/registry";
import { SITE_INFO } from "@/config/site";
import { getComponentDocs } from "@/lib/documents";

export const dynamic = "force-static";
export const revalidate = false;

export default function sitemap(): MetadataRoute.Sitemap {
	const components = getComponentDocs().map((doc) => ({
		url: `${SITE_INFO.url}/components/${doc.slug}`,
		lastModified: new Date(doc.metadata.updatedAt),
	}));

	const blockCategoriesUrls = blockCategories.map((category) => ({
		url: `${SITE_INFO.url}/blocks/${category.name}`,
	}));

	return [
		{ url: SITE_INFO.url },
		{ url: `${SITE_INFO.url}/components` },
		{ url: `${SITE_INFO.url}/blocks` },
		...components,
		...blockCategoriesUrls,
	];
}
