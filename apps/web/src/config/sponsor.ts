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
	name: "SRB",
	href: "https://www.srb.codes",
	logoSrc: "/images/srb-logo.svg",
	logoDarkSrc: "/images/srb-logo-dark.svg",
};

export function sponsorHref(href: string) {
	const url = new URL(href);
	url.searchParams.set("ref", SPONSOR_REF);
	return url.toString();
}

export function sponsorMailto() {
	const subject = encodeURIComponent("Sponsorship — TentUI");
	return `mailto:${SPONSOR_EMAIL}?subject=${subject}`;
}
