"use client";

import { useQuery } from "@tanstack/react-query";

import {
	FEED_SPONSOR,
	type FeedSponsor,
	HEADER_SPONSOR,
	type HeaderSponsor,
} from "@/config/sponsor";
import type { SponsorSlots } from "@/lib/sponsors/store";

export function useSponsorSlots() {
	return useQuery({
		queryKey: ["sponsor-slots"],
		queryFn: async () => {
			const response = await fetch("/api/sponsor/slots");
			if (!response.ok) throw new Error("Sponsor slots request failed");
			return (await response.json()) as SponsorSlots;
		},
		staleTime: 60_000,
		retry: 1,
	});
}

/**
 * The sponsor to show in each placement: a paid booking, else the house ad.
 * `undefined` while loading, so the slot can keep its space without flashing
 * the house ad first.
 */
export function useShownSponsors() {
	const { data, isError } = useSponsorSlots();
	if (!data && !isError) return undefined;

	const header = data?.header.sponsor;
	const feed = data?.feed.sponsor;
	return {
		header: header
			? ({
					name: header.name,
					href: header.href,
					logoSrc: header.logoSrc,
				} satisfies HeaderSponsor)
			: HEADER_SPONSOR,
		feed:
			feed?.imageSrc && feed.description
				? ({
						name: feed.name,
						href: feed.href,
						logoSrc: feed.logoSrc,
						description: feed.description,
						imageSrc: feed.imageSrc,
					} satisfies FeedSponsor)
				: FEED_SPONSOR,
	};
}
