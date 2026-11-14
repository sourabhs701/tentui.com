"use client";

import { useEffect, useState } from "react";

import InkFilterBarPreview from "@/registry/examples/ink-filter-bar-preview";

/**
 * The still shows Cycling already absorbed into the capsule, since that's the
 * point of it. Motion takes load the page with `?motion` and start with no
 * filter, so the scripted clicks absorb and detach the chips.
 */
export function InkFilterBarCapture() {
	const [selected, setSelected] = useState<string[] | null>(null);

	useEffect(() => {
		setSelected(
			new URLSearchParams(window.location.search).has("motion")
				? []
				: ["cycling"],
		);
	}, []);

	if (selected === null) return null;
	return <InkFilterBarPreview defaultValue={selected} />;
}
