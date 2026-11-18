"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import ScrollAccordionPreview from "@/registry/examples/scroll-accordion-preview";

/** Px into the third section for the still, so its ring shows part-filled. */
const STILL_READ = 40;

/**
 * The still opens partway through the third step: two read cards stacked
 * above, the open card's ring filling, and the rest waiting below. Motion
 * takes load the page with `?motion` and start at the top, so the scripted
 * scroll builds the deck from nothing.
 */
export function ScrollAccordionCapture() {
	const [still, setStill] = useState<boolean | null>(null);
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setStill(!new URLSearchParams(window.location.search).has("motion"));
	}, []);

	// Runs after the accordion's own layout effect has opened "first-pour".
	useLayoutEffect(() => {
		if (!still) return;
		const viewport = rootRef.current?.querySelector<HTMLElement>(
			'[data-slot="scroll-accordion-viewport"]',
		);
		if (!viewport) return;
		viewport.style.scrollSnapType = "none";
		viewport.scrollTop += STILL_READ;
	}, [still]);

	if (still === null) return null;
	return (
		<div ref={rootRef} className="contents">
			<ScrollAccordionPreview defaultValue={still ? "first-pour" : undefined} />
		</div>
	);
}
