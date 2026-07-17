"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useHotkeys } from "react-hotkeys-hook";

export function DocKeyboardShortcuts({
	previous,
	next,
}: {
	previous: Route | null;
	next: Route | null;
}) {
	const router = useRouter();

	useHotkeys("ArrowLeft", (event) => {
		if (!event.defaultPrevented && previous) router.push(previous);
	});
	useHotkeys("ArrowRight", (event) => {
		if (!event.defaultPrevented && next) router.push(next);
	});

	return null;
}
