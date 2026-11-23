"use client";

import { useEffect, useRef, useState } from "react";

import {
	TextScramble,
	type TextScrambleHandle,
} from "@/registry/components/text-scramble/text-scramble";

const WORDS = ["Precision", "Clarity", "Velocity"] as const;

/**
 * Capture scene for the 480x360 component gallery card.
 *
 * The static still shows "Precision" cleanly mid-scramble — settled ink on the
 * left and optically width-locked alphanumeric glyphs resolving left-to-right —
 * so the interaction reads at a glance without hovering. Motion captures load
 * with `?motion` and drive the live `TextScramble` on pointer/click events.
 */
export function TextScrambleCapture() {
	const [motion, setMotion] = useState<boolean | null>(null);
	const [index, setIndex] = useState(0);
	const scrambleRef = useRef<TextScrambleHandle>(null);

	useEffect(() => {
		setMotion(new URLSearchParams(window.location.search).has("motion"));
	}, []);

	if (motion === null) return null;

	if (motion) {
		return (
			<div className="flex w-full flex-col items-center gap-3 px-6 text-center">
				<button
					type="button"
					data-slot="text-scramble-capture-trigger"
					onClick={() => setIndex((current) => (current + 1) % WORDS.length)}
					onPointerEnter={(event) => {
						if (event.pointerType !== "touch") {
							scrambleRef.current?.replay();
						}
					}}
					className="cursor-pointer rounded-md outline-none"
				>
					<TextScramble
						ref={scrambleRef}
						as="span"
						size="xl"
						trigger="manual"
						duration={760}
						speed={36}
						className="mx-auto w-fit text-center"
					>
						{WORDS[index]!}
					</TextScramble>
				</button>
			</div>
		);
	}

	const scrambling = [
		{ id: "i", glyph: "i", opacity: 0.92, y: -1.5 },
		{ id: "s", glyph: "k", opacity: 0.56 },
		{ id: "i2", glyph: "7", opacity: 0.48 },
		{ id: "o", glyph: "x", opacity: 0.4 },
		{ id: "n", glyph: "4", opacity: 0.32 },
	];

	return (
		<div className="flex w-full flex-col items-center px-6 text-center">
			<div
				aria-hidden="true"
				className="inline-flex items-baseline font-semibold text-5xl leading-[1.06] tracking-[-0.03em] sm:text-6xl sm:tracking-[-0.035em]"
			>
				<span>Prec</span>
				{scrambling.map((item) => (
					<span
						key={item.id}
						style={{
							opacity: item.opacity,
							transform: item.y ? `translate3d(0, ${item.y}px, 0)` : undefined,
						}}
						className="inline-block"
					>
						{item.glyph}
					</span>
				))}
			</div>
		</div>
	);
}
