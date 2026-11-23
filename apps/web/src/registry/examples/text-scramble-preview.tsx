"use client";

import { useRef, useState } from "react";

import {
	TextScramble,
	type TextScrambleHandle,
} from "@/registry/components/text-scramble/text-scramble";

const PHRASES = [
	"Precision in motion",
	"Crafted in detail",
	"Built for clarity",
] as const;

function TextScramblePreview() {
	const [index, setIndex] = useState(0);
	const scrambleRef = useRef<TextScrambleHandle>(null);

	return (
		<div className="flex w-full flex-col items-center gap-3 px-4 text-center">
			<button
				type="button"
				onClick={() => setIndex((current) => (current + 1) % PHRASES.length)}
				onPointerEnter={(event) => {
					if (event.pointerType !== "touch") {
						scrambleRef.current?.replay();
					}
				}}
				className="min-h-11 max-w-full cursor-pointer rounded-md px-2 py-2 outline-none transition-transform duration-150 ease-out [-webkit-tap-highlight-color:transparent] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-4 focus-visible:ring-offset-background active:scale-[0.985] sm:py-1"
				aria-label="Cycle scrambled headline"
			>
				<TextScramble
					ref={scrambleRef}
					as="span"
					size="xl"
					trigger="view"
					className="mx-auto w-fit max-w-full text-balance"
				>
					{PHRASES[index]!}
				</TextScramble>
			</button>
			<p className="text-muted-foreground text-xs">
				<span className="pointer-coarse:hidden">
					Hover to scramble, click to cycle
				</span>
				<span className="pointer-coarse:inline hidden">
					Tap to scramble and cycle
				</span>
			</p>
		</div>
	);
}

export default TextScramblePreview;
