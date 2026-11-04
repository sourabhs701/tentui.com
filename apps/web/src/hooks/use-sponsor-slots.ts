"use client";

import { useQuery } from "@tanstack/react-query";

import {
	FEED_SPONSOR,
	type FeedSponsor,
	HEADER_SPONSOR,
	type HeaderSponsor,
	SPONSOR_PLACEMENTS,
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
 * What each placement shows: its paid bookings, then the house ad while a
 * slot is still free. The feed gets one entry per card position; `null`
 * there is an open slot. `undefined` while loading, so the slots can keep
 * their space without flashing the house ad first.
 */
export function useShownSponsors() {
	const { data, isError } = useSponsorSlots();
	if (!data && !isError) return undefined;

	const header: HeaderSponsor[] = (data?.header.sponsors ?? []).map(
		(sponsor) => ({
			name: sponsor.name,
			href: sponsor.href,
			logoSrc: sponsor.logoSrc,
		}),
	);
	if (HEADER_SPONSOR && header.length < SPONSOR_PLACEMENTS.header.slots) {
		header.push(HEADER_SPONSOR);
	}

	const feed: (FeedSponsor | null)[] = (data?.feed.sponsors ?? []).flatMap(
		(sponsor) =>
			sponsor.imageSrc && sponsor.description
				? [
						{
							name: sponsor.name,
							href: sponsor.href,
							logoSrc: sponsor.logoSrc,
							description: sponsor.description,
							imageSrc: sponsor.imageSrc,
						},
					]
				: [],
	);
	if (FEED_SPONSOR && feed.length < SPONSOR_PLACEMENTS.feed.slots) {
		feed.push(FEED_SPONSOR);
	}
	while (feed.length < SPONSOR_PLACEMENTS.feed.slots) feed.push(null);

	return {
		header: header.slice(0, SPONSOR_PLACEMENTS.header.slots),
		/** Show the dashed "sponsor" button while a top-bar slot is free. */
		headerOpen: data ? data.header.available : true,
		feed: feed.slice(0, SPONSOR_PLACEMENTS.feed.slots),
	};
}
