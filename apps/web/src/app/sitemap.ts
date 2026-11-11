import type { MetadataRoute } from "next";

import { blockCategories } from "@/config/registry";
import { SITE_INFO } from "@/config/site";
import { getBlogPosts, getComponentDocs, getDocs } from "@/lib/documents";
import { blocks } from "@/registry/blocks/_registry";

export const dynamic = "force-static";
export const revalidate = false;

/**
 * Last content edits for pages without frontmatter. File stats and git are
 * unavailable on Workers, so bump these when the page content changes.
 */
const STATIC_PAGE_UPDATED_AT = {
	changelog: "2026-07-26",
	sponsor: "2026-11-11",
	license: "2026-07-18",
	terms: "2026-05-22",
	privacy: "2026-05-22",
	copyright: "2026-05-22",
} as const;

function latestDate(dates: Array<Date | string | undefined>) {
	const times = dates
		.filter((date) => date !== undefined)
		.map((date) => new Date(date).getTime());

	return times.length ? new Date(Math.max(...times)) : undefined;
}

function getBlocksUpdatedAt(category?: string) {
	return latestDate(
		blocks
			.filter((block) => !category || block.categories?.includes(category))
			.map((block) => block.meta?.updatedAt ?? block.meta?.createdAt),
	);
}

export default function sitemap(): MetadataRoute.Sitemap {
	const componentDocs = getComponentDocs();
	const posts = getBlogPosts();

	const components = componentDocs.map((doc) => ({
		url: `${SITE_INFO.url}/components/${doc.slug}`,
		lastModified: new Date(doc.metadata.updatedAt),
	}));
	const docs = getDocs().map((doc) => ({
		url: `${SITE_INFO.url}${doc.slug === "introduction" ? "/docs" : `/docs/${doc.slug}`}`,
		lastModified: new Date(doc.metadata.updatedAt),
	}));
	const blogPosts = posts.map((post) => ({
		url: `${SITE_INFO.url}/blog/${post.slug}`,
		lastModified: new Date(post.metadata.updatedAt),
	}));

	const blockCategoriesUrls = blockCategories.map((category) => ({
		url: `${SITE_INFO.url}/blocks/${category.name}`,
		lastModified: getBlocksUpdatedAt(category.name),
	}));

	const componentsUpdatedAt = latestDate(
		componentDocs.map((doc) => doc.metadata.updatedAt),
	);
	const blocksUpdatedAt = getBlocksUpdatedAt();

	return [
		{
			url: SITE_INFO.url,
			lastModified: latestDate([componentsUpdatedAt, blocksUpdatedAt]),
		},
		{ url: `${SITE_INFO.url}/components`, lastModified: componentsUpdatedAt },
		{ url: `${SITE_INFO.url}/blocks`, lastModified: blocksUpdatedAt },
		{
			url: `${SITE_INFO.url}/blog`,
			lastModified: latestDate(posts.map((post) => post.metadata.updatedAt)),
		},
		...Object.entries(STATIC_PAGE_UPDATED_AT).map(([page, updatedAt]) => ({
			url: `${SITE_INFO.url}/${page}`,
			lastModified: new Date(updatedAt),
		})),
		...docs,
		...components,
		...blogPosts,
		...blockCategoriesUrls,
	];
}
