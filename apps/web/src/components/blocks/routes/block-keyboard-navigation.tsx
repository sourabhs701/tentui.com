"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function isTypingTarget(target: EventTarget | null) {
	return (
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement ||
		(target instanceof HTMLElement && target.isContentEditable)
	);
}

export function BlockKeyboardNavigation({
	previous,
	next,
}: {
	previous: Route | null;
	next: Route | null;
}) {
	const router = useRouter();

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				isTypingTarget(event.target)
			) {
				return;
			}

			if (event.key === "ArrowLeft" && previous) {
				router.push(previous);
			}

			if (event.key === "ArrowRight" && next) {
				router.push(next);
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [next, previous, router]);

	return null;
}
