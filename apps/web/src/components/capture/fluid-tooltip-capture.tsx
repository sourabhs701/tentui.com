"use client";

import { useEffect, useRef } from "react";

import FluidTooltipPreview from "@/registry/examples/fluid-tooltip-preview";

/** Ms from mount until the tooltip has opened and settled: delay plus fade. */
const SETTLE = 1000;

/**
 * The still shows the tooltip open on Link, at rest, since that's the point of
 * it. It hovers Link with a synthetic pointer and holds the capture until the
 * bubble settles. Motion takes load the page with `?motion` and start closed,
 * so the scripted cursor opens it.
 */
export function FluidTooltipCapture() {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const root = ref.current;
		if (!root || new URLSearchParams(window.location.search).has("motion")) {
			return;
		}
		// A no-op animation the capture stage waits for before it's ready.
		root.animate([{ opacity: 1 }, { opacity: 1 }], { duration: SETTLE });
		root.querySelector('[aria-label="Link"]')?.dispatchEvent(
			new PointerEvent("pointerover", {
				bubbles: true,
				pointerType: "mouse",
			}),
		);
	}, []);

	return (
		<div ref={ref}>
			<FluidTooltipPreview />
		</div>
	);
}
