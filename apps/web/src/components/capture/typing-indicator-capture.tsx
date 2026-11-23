"use client";

import { useState } from "react";

import {
	TypingIndicator,
	type TypingIndicatorVariant,
} from "@/registry/components/typing-indicator/typing-indicator";

const MODES: readonly {
	id: TypingIndicatorVariant;
	label: string;
	users: { name: string; color: string }[];
}[] = [
	{
		id: "ink",
		label: "Ink",
		users: [{ name: "Maya", color: "#0284c7" }],
	},
	{
		id: "dots",
		label: "Dots",
		users: [
			{ name: "Maya", color: "#0284c7" },
			{ name: "Sam", color: "#059669" },
		],
	},
	{
		id: "wave",
		label: "Wave",
		users: [{ name: "Maya", color: "#0284c7" }],
	},
];

/**
 * Deterministic 4:3 capture scene for the /components index card.
 * Starts on the signature calligraphic ink stroke inside a clean chat exchange,
 * and lets the video scenario switch across Ink, Dots (multi-user), and Wave
 * before returning to Ink so the clip loops cleanly.
 */
export function TypingIndicatorCapture() {
	const [modeIndex, setModeIndex] = useState(0);
	const current = MODES[modeIndex]!;

	return (
		<div className="flex w-[276px] flex-col items-center gap-5">
			<div className="flex w-full flex-col gap-3">
				<div className="flex justify-end">
					<div className="rounded-2xl rounded-ee-[6px] bg-foreground px-3.5 py-2 text-[13px] text-background leading-snug">
						Ready to ship the release?
					</div>
				</div>

				<div className="flex items-end gap-2">
					<span
						aria-hidden="true"
						className="inline-flex size-6 shrink-0 select-none items-center justify-center rounded-full bg-sky-600 font-medium text-[11px] text-white"
					>
						M
					</span>
					<TypingIndicator
						variant={current.id}
						surface="bubble"
						size="lg"
						ariaLabel="Maya is typing"
					/>
				</div>

				<div className="flex items-center pl-8">
					<TypingIndicator
						variant={current.id}
						surface="pill"
						size="sm"
						users={current.users}
					/>
				</div>
			</div>

			<div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/55 p-1">
				{MODES.map((mode, index) => {
					const selected = index === modeIndex;
					return (
						<button
							key={mode.id}
							type="button"
							data-typing-mode={mode.id}
							onClick={() => setModeIndex(index)}
							className={`cursor-pointer rounded-full px-3 py-1 font-medium text-xs transition-[background-color,color] duration-150 ease-out ${
								selected
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground"
							}`}
						>
							{mode.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}
