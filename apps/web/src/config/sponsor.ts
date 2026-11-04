export const SPONSOR_EMAIL = "sourabh@srb.codes";

const SPONSOR_REF = "tentui.com";

export type HeaderSponsor = {
	name: string;
	/** Destination for the header logo. `ref=tentui.com` is added. */
	href: string;
	logoSrc: string;
	logoDarkSrc?: string;
};

/** Booked top-bar sponsor. `null` leaves the header slot open. */
export const HEADER_SPONSOR: HeaderSponsor | null = {
	name: "srb.codes",
	href: "https://www.srb.codes",
	logoSrc: "/images/srb-logo.svg",
	logoDarkSrc: "/images/srb-logo-dark.svg",
};

export type FeedSponsor = {
	name: string;
	/** Destination for the feed card. `ref=tentui.com` is added. */
	href: string;
	/** Square mark shown in the card's bottom-left corner. */
	logoSrc: string;
	logoDarkSrc?: string;
	/** One short line, revealed beside the logo on hover. */
	description: string;
	imageSrc: string;
	imageDarkSrc?: string;
	/** Optional looping clip, played while the card is hovered. */
	videoSrc?: string;
};

/** Booked feed-card sponsor on /components. `null` shows the open slot. */
export const FEED_SPONSOR: FeedSponsor | null = {
	name: "srb.codes",
	href: "https://work.srb.codes",
	logoSrc: "/images/srb-logo.svg",
	logoDarkSrc: "/images/srb-logo-dark.svg",
	description: "A design studio that ships in days",
	imageSrc: "/images/sponsors/srb-work.webp",
};

/** Position of the feed card: the end of the first row at three columns. */
export const FEED_SPONSOR_INDEX = 2;

export function sponsorHref(href: string) {
	const url = new URL(href);
	url.searchParams.set("ref", SPONSOR_REF);
	return url.toString();
}

export type SponsorPlacement = "header" | "feed";

export type SponsorPlacementInfo = {
	label: string;
	/** Monthly price in US dollars. Keep in step with the Dodo product. */
	price: number;
	summary: string;
};

/**
 * Bookable placements. Each has one slot; the house ads above fill it until
 * someone books it. Checkout uses the Dodo product in
 * `DODO_PRODUCT_HEADER_ID` / `DODO_PRODUCT_FEED_ID`.
 */
export const SPONSOR_PLACEMENTS: Record<
	SponsorPlacement,
	SponsorPlacementInfo
> = {
	header: {
		label: "Top bar",
		price: 149,
		summary: "Your logo in the bar at the top of every page.",
	},
	feed: {
		label: "Feed card",
		price: 299,
		summary: "Your image at the end of the first row on /components.",
	},
};

export const SPONSOR_PLACEMENT_IDS = Object.keys(
	SPONSOR_PLACEMENTS,
) as SponsorPlacement[];

export function sponsorMailto() {
	const subject = encodeURIComponent("Sponsorship — TentUI");
	return `mailto:${SPONSOR_EMAIL}?subject=${subject}`;
}
