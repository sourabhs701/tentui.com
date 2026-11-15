"use client";

import { useEffect, useState } from "react";

import LiquidGlassMenuPreview from "@/registry/examples/liquid-glass-menu-preview";

/**
 * The still shows the menu open, since that's the point of it. Motion takes
 * load the page with `?motion` and start closed, so the scripted click opens it.
 */
export function LiquidGlassMenuCapture() {
	const [open, setOpen] = useState<boolean | null>(null);

	useEffect(() => {
		setOpen(!new URLSearchParams(window.location.search).has("motion"));
	}, []);

	if (open === null) return null;
	return <LiquidGlassMenuPreview defaultOpen={open} />;
}
