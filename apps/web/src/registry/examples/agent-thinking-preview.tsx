"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

import {
	AgentThinking,
	type AgentThinkingStep,
} from "@/registry/components/agent-thinking/agent-thinking";

const STEPS = [
	"Reading the question",
	"Searching the docs",
	"Comparing 3 sources",
	"Checking the code",
	"Writing the answer",
];
/** Ms into the run each step finishes; the last one ends the run. */
const FINISH_AT = [1000, 2200, 3300, 4400, 5500];
const END = FINISH_AT[FINISH_AT.length - 1];
/** Ms into the run it fades out, and the next one starts. */
const FADE_AT = 7600;
const LOOP_AT = 8000;

const REASONING =
	"The question is how to show tool calls while the answer streams. The AI SDK docs cover useChat and streamText, so I'll start there. Three sources disagree on when a tool result is merged; the v5 changelog settles it. In the code, message.parts carries every tool call with its state, so each one maps straight to a step.";
const WORDS = REASONING.split(" ");

/** True while the element is on screen and the tab is visible. */
function useActive(ref: RefObject<HTMLElement | null>) {
	const [active, setActive] = useState(false);
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		let onScreen = false;
		const update = () =>
			setActive(onScreen && document.visibilityState !== "hidden");
		const observer = new IntersectionObserver(([entry]) => {
			onScreen = entry?.isIntersecting ?? false;
			update();
		});
		observer.observe(element);
		document.addEventListener("visibilitychange", update);
		return () => {
			observer.disconnect();
			document.removeEventListener("visibilitychange", update);
		};
	}, [ref]);
	return active;
}

/**
 * A looping scripted run on its own clock, ticking every 100 ms so the
 * reasoning streams. It only advances while `active`, so scrolling away or
 * hiding the tab pauses it, and `epoch` shifts to match.
 */
function useRunClock(active: boolean) {
	const [clock, setClock] = useState({ run: 0, elapsed: 0, epoch: 0 });
	const elapsedRef = useRef(0);
	const runRef = useRef(0);

	useEffect(() => {
		if (!active) return;
		let epoch = Date.now() - elapsedRef.current;
		const tick = () => {
			let elapsed = Date.now() - epoch;
			if (elapsed >= LOOP_AT) {
				runRef.current += 1;
				epoch = Date.now();
				elapsed = 0;
			}
			elapsedRef.current = elapsed;
			setClock({ run: runRef.current, elapsed, epoch });
		};
		tick();
		const interval = window.setInterval(tick, 100);
		return () => window.clearInterval(interval);
	}, [active]);

	return clock;
}

function AgentThinkingPreview() {
	const ref = useRef<HTMLDivElement>(null);
	const { run, elapsed, epoch } = useRunClock(useActive(ref));

	const finished = FINISH_AT.filter((at) => elapsed >= at).length;
	const steps: AgentThinkingStep[] = STEPS.slice(0, finished + 1).map(
		(label, index) => ({
			id: `${run}-${index}`,
			label,
			status: index < finished ? "done" : "active",
			durationMs:
				index < finished
					? FINISH_AT[index] - (FINISH_AT[index - 1] ?? 0)
					: undefined,
		}),
	);
	const done = finished === STEPS.length;
	const shared = {
		status: done ? ("done" as const) : ("thinking" as const),
		startedAt: epoch || undefined,
		endedAt: done && epoch ? epoch + END : undefined,
	};
	// The first words arrive a moment in, and the last just before the end.
	const words = Math.ceil((WORDS.length * (elapsed - 400)) / (END - 800));
	const reasoning = WORDS.slice(
		0,
		Math.max(0, Math.min(words, WORDS.length)),
	).join(" ");

	return (
		<div
			ref={ref}
			// As tall as the run, so nothing moves as the card unfolds and folds.
			className="flex h-68 w-72 max-w-full flex-col gap-4 transition-opacity duration-300"
			style={{ opacity: elapsed >= FADE_AT ? 0 : 1 }}
		>
			<AgentThinking key={`cluster-${run}`} {...shared} steps={steps} />
			<AgentThinking
				key={`shimmer-${run}`}
				variant="shimmer"
				{...shared}
				steps={steps}
			/>
			<div className="flex">
				<div className="flex rounded-2xl rounded-bl-md bg-muted px-3 py-2">
					<AgentThinking key={`orb-${run}`} variant="orb" {...shared} />
				</div>
			</div>
			<AgentThinking
				key={`card-${run}`}
				variant="card"
				{...shared}
				reasoning={reasoning}
			/>
		</div>
	);
}

export default AgentThinkingPreview;
