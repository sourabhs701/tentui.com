import { blockCategories } from "@/config/registry";
import { SITE_INFO } from "@/config/site";
import { getComponentDocs } from "@/lib/documents";
import { parseRssDate, type RssItem } from "@/lib/rss";
import { blocks } from "@/registry/blocks/_registry";

export function getComponentRssItems(): RssItem[] {
	return getComponentDocs().map((doc) => ({
		title: doc.metadata.title,
		description: doc.metadata.description,
		url: absoluteUrl(`/components/${doc.slug}`),
		publishedAt: parseRssDate(doc.metadata.createdAt, doc.metadata.title),
		category: "Component",
	}));
}

export function getBlockRssItems(): RssItem[] {
	return blocks.map((block) => {
		const title = block.title ?? block.name;
		const description = block.description;
		if (!description) {
			throw new Error(`[rss] Missing description for "${title}".`);
		}

		const category = block.categories?.find((categoryName) =>
			blockCategories.some((candidate) => candidate.name === categoryName),
		);
		if (!category) {
			throw new Error(`[rss] Missing configured category for "${title}".`);
		}

		return {
			title,
			description,
			url: absoluteUrl(`/blocks/${category}#${block.name}`),
			publishedAt: parseRssDate(block.meta?.createdAt, title),
			category: "Block",
		};
	});
}

export function absoluteUrl(pathname: string): string {
	return new URL(pathname, SITE_INFO.url).toString();
}
