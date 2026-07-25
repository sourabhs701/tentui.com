import type { MetadataRoute } from "next";

import { blockCategories } from "@/config/registry";
import { SITE_INFO } from "@/config/site";
import { getBlogPosts, getComponentDocs, getDocs } from "@/lib/documents";

export const dynamic = "force-static";
export const revalidate = false;

export default function sitemap(): MetadataRoute.Sitemap {
	const components = getComponentDocs().map((doc) => ({
		url: `${SITE_INFO.url}/components/${doc.slug}`,
		lastModified: new Date(doc.metadata.updatedAt),
	}));
	const docs = getDocs().map((doc) => ({
		url: `${SITE_INFO.url}${doc.slug === "introduction" ? "/docs" : `/docs/${doc.slug}`}`,
		lastModified: new Date(doc.metadata.updatedAt),
	}));
	const blogPosts = getBlogPosts().map((post) => ({
		url: `${SITE_INFO.url}/blog/${post.slug}`,
		lastModified: new Date(post.metadata.updatedAt),
	}));

	const blockCategoriesUrls = blockCategories.map((category) => ({
		url: `${SITE_INFO.url}/blocks/${category.name}`,
	}));

	return [
		{ url: SITE_INFO.url },
		{ url: `${SITE_INFO.url}/components` },
		{ url: `${SITE_INFO.url}/blocks` },
		{ url: `${SITE_INFO.url}/blog` },
		{ url: `${SITE_INFO.url}/license` },
		{ url: `${SITE_INFO.url}/terms` },
		{ url: `${SITE_INFO.url}/privacy` },
		{ url: `${SITE_INFO.url}/copyright` },
		...docs,
		...components,
		...blogPosts,
		...blockCategoriesUrls,
	];
}
