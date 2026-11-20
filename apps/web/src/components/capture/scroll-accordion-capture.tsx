"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import ScrollAccordionPreview from "@/registry/examples/scroll-accordion-preview";

/**
 * Px into the third section for the still, so its ring shows part-filled:
 * the body's top padding and first line, so the cut falls between lines.
 */
const STILL_READ = 40;
/** The deck's default peek, in px. */
const PEEK = 12;

/**
 * The still opens partway through the third step: two read cards stacked
 * above, the open card's ring filling, and the next card docked below with
 * the last one peeking under it, so the band holds only the open step. Motion
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
		const next = viewport.querySelectorAll<HTMLElement>(
			'[data-slot="scroll-accordion-content"]',
		)[3];
		if (!next) return;
		// Past this, the fourth header lifts off its slot into the band.
		const docked = next.offsetTop - viewport.clientHeight + PEEK;
		viewport.style.scrollSnapType = "none";
		viewport.scrollTop = Math.min(viewport.scrollTop + STILL_READ, docked);
	}, [still]);

	if (still === null) return null;
	return (
		<div ref={rootRef} className="contents">
			<ScrollAccordionPreview defaultValue={still ? "first-pour" : undefined} />
		</div>
	);
}
