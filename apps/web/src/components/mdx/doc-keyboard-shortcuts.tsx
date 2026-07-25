"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useHotkeys } from "react-hotkeys-hook";

function canNavigate(event: KeyboardEvent) {
	return event.target === document.body;
}

export function DocKeyboardShortcuts({
	previous,
	next,
}: {
	previous: Route | null;
	next: Route | null;
}) {
	const router = useRouter();

	useHotkeys("ArrowLeft", (event) => {
		if (!event.defaultPrevented && canNavigate(event) && previous) {
			router.push(previous);
		}
	});
	useHotkeys("ArrowRight", (event) => {
		if (!event.defaultPrevented && canNavigate(event) && next) {
			router.push(next);
		}
	});

	return null;
}
