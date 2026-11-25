"use client";

import { useEffect, useRef, useState } from "react";

import ShareSheetPreview from "@/registry/examples/share-sheet-preview";

/** Time in ms to let the spring settle before the static still is snapped. */
const SETTLE_MS = 450;

/**
 * Framed for the 480x360 component card capture.
 * Static stills start with the compact share sheet open beneath its trigger so
 * the destinations rail, link pill, and actions read immediately; motion
 * captures (`?motion`) start closed so the scripted cursor opens it, copies
 * the link, taps a target and an action, and closes cleanly.
 */
export function ShareSheetCapture() {
	const rootRef = useRef<HTMLDivElement>(null);
	const [initialOpen, setInitialOpen] = useState<boolean | null>(null);

	useEffect(() => {
		const isMotion = new URLSearchParams(window.location.search).has("motion");
		setInitialOpen(!isMotion);
		if (!isMotion) {
			rootRef.current?.animate([{ opacity: 1 }, { opacity: 1 }], {
				duration: SETTLE_MS,
			});
		}
	}, []);

	return (
		<div ref={rootRef} className="flex size-full items-center justify-center">
			{initialOpen !== null ? (
				<ShareSheetPreview defaultOpen={initialOpen} />
			) : null}
		</div>
	);
}
