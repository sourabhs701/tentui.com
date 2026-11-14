"use client";

import { useEffect, useRef, useState } from "react";

import PromptChipInputPreview from "@/registry/examples/prompt-chip-input-preview";

/** Ms from typing "@an" until the capsule and list have settled. */
const SETTLE = 600;

/**
 * The still shows the three chips at rest plus a live "@an" capsule with its
 * ghost text and the list open, since that's the point of it. Motion takes
 * load the page with `?motion` and start from "Ask ", so the scripted typing
 * builds the prompt.
 */
export function PromptChipInputCapture() {
	const ref = useRef<HTMLDivElement>(null);
	const [motion, setMotion] = useState<boolean | null>(null);

	useEffect(() => {
		setMotion(new URLSearchParams(window.location.search).has("motion"));
	}, []);

	useEffect(() => {
		const root = ref.current;
		const editable = root?.querySelector<HTMLElement>(
			'[data-slot="prompt-chip-input-editable"]',
		);
		if (motion === null || !root || !editable) return;
		// Focused from the start, with the caret before the trailing <br>, so
		// the take never changes focus styling.
		const focusEnd = () => {
			editable.focus({ preventScroll: true });
			const end = Math.max(0, editable.childNodes.length - 1);
			window.getSelection()?.setBaseAndExtent(editable, end, editable, end);
		};
		if (motion) {
			focusEnd();
			return;
		}
		// A no-op animation the capture stage waits for before it's ready.
		root.animate([{ opacity: 1 }, { opacity: 1 }], { duration: SETTLE });
		// Typed once the page has settled, as text input, so the field reacts
		// as it does to keys.
		const timer = setTimeout(() => {
			focusEnd();
			document.execCommand("insertText", false, " cc ");
			document.execCommand("insertText", false, "@an");
		}, 100);
		return () => clearTimeout(timer);
	}, [motion]);

	if (motion === null) return null;
	return (
		// The take keeps the field focused, so drop its focus ring: media shows
		// no focus styling.
		<div ref={ref} className="w-full" data-capture="prompt-chip-input">
			<style>
				{
					'[data-capture="prompt-chip-input"] [data-slot="prompt-chip-input"]{border-color:var(--border)!important;box-shadow:none!important}'
				}
			</style>
			<PromptChipInputPreview
				defaultValue={motion ? [{ type: "text", text: "Ask " }] : undefined}
			/>
		</div>
	);
}
