import type { Metadata } from "next";

/**
 * Previews are bare iframe documents for block and component pages, so they
 * stay out of search results (noindex) and carry no canonical of their own.
 * `indexifembedded` lets Google credit their content to the page that embeds
 * them, and `follow` keeps link signals flowing. robots.txt must not disallow
 * /preview/, or crawlers never see this tag or render the iframes.
 */
export const previewRobots = {
	index: false,
	follow: true,
	indexifembedded: true,
} satisfies Metadata["robots"];
