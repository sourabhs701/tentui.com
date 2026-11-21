"use client";

import { useEffect, useRef, useState } from "react";

import HoverPeekCardPreview from "@/registry/examples/hover-peek-card-preview";

/** Time in ms to let the portaled spring settle before the static still is snapped. */
const SETTLE_MS = 450;

/**
 * Framed for the 480x360 component card capture.
 * Static stills start with the first peek card lifted above its trigger so the
 * overlay is immediately legible; motion captures (`?motion`) start closed so
 * the scripted cursor hovers in, glides across triggers, and settles back.
 */
export function HoverPeekCardCapture() {
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
		<div
			ref={rootRef}
			className="flex size-full flex-col items-center justify-end px-4 pb-5"
		>
			{initialOpen !== null ? (
				<HoverPeekCardPreview initialOpenFirst={initialOpen} />
			) : null}
		</div>
	);
}
