"use client";

import { useEffect, useState } from "react";

import RollingStatPreview from "@/registry/examples/rolling-stat-preview";

/** The live value the preview starts on. */
const START_VALUE = 48290;

/**
 * The still holds the preview at rest, without its demo ticks. Motion takes
 * load the page with `?motion`, and the scenario sets each new live value
 * with a `rolling-stat-capture` event, so the rolls land on its timeline.
 */
export function RollingStatCapture() {
	const [value, setValue] = useState(START_VALUE);

	useEffect(() => {
		const onValue = (event: Event) => {
			const next = (event as CustomEvent<number>).detail;
			setValue(Number.isFinite(next) ? next : START_VALUE);
		};
		window.addEventListener("rolling-stat-capture", onValue);
		return () => window.removeEventListener("rolling-stat-capture", onValue);
	}, []);

	return <RollingStatPreview value={value} ticking={false} />;
}
