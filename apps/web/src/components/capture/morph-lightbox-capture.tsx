"use client";

import { useEffect, useState } from "react";

import MorphLightboxPreview, {
	photos,
} from "@/registry/examples/morph-lightbox-preview";

/** The still opens on the poppies, a landscape photo with a neighbour each side. */
const STILL_INDEX = 2;

/**
 * The still shows the viewer open, since that's the point of it. Motion takes
 * load the page with `?motion` and start on the grid, so the scripted click
 * opens it.
 */
export function MorphLightboxCapture() {
	const [open, setOpen] = useState<boolean | null>(null);

	useEffect(() => {
		setOpen(!new URLSearchParams(window.location.search).has("motion"));
	}, []);

	if (open === null) return null;
	return (
		<>
			<MorphLightboxPreview defaultOpen={open} defaultIndex={STILL_INDEX} />
			{open ? (
				// The viewer is portaled out of the stage, which only waits for images
				// inside it. Hidden copies of the visible slides hold the still.
				<div
					aria-hidden
					className="pointer-events-none fixed size-px opacity-0"
				>
					{photos.slice(STILL_INDEX - 1, STILL_INDEX + 2).map((photo) => (
						// biome-ignore lint/performance/noImgElement: preloads the slides' plain images
						<img key={photo.src} src={photo.src} alt="" className="size-px" />
					))}
				</div>
			) : null}
		</>
	);
}
