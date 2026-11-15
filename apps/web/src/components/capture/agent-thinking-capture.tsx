"use client";

import { useEffect, useState } from "react";

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
const DURATIONS = [1000, 1200, 1100, 1100, 1800];

/** Ms into the take each remaining step lands; the last one ends the run. */
const TAKE_FINISH = [700, 1800, 3600];
/** Ms into the take it resets to its first frame, so the clip loops. */
const TAKE_RESET = 6600;
/** The take opens mid-run, this far in, with two steps landed. */
const TAKE_ELAPSED = 2200;

function stepsFor(finished: number, run: number): AgentThinkingStep[] {
	return STEPS.slice(0, Math.min(finished + 1, STEPS.length)).map(
		(label, index) => ({
			id: `${run}-${index}`,
			label,
			status: index < finished ? "done" : "active",
			durationMs: index < finished ? DURATIONS[index] : undefined,
		}),
	);
}

/**
 * The still is a run in progress: a cluster of six dots, the seeking dot, and
 * the timer at "4s". Motion takes load the page with `?motion`, and the video
 * scenario dispatches `agent-thinking-capture` to start a run from two landed
 * steps on the virtual clock, so the take is the same every time.
 */
export function AgentThinkingCapture() {
	const [motion, setMotion] = useState<boolean | null>(null);
	const [take, setTake] = useState({ run: 0, finished: 2, startedAt: 0 });
	const [endedAt, setEndedAt] = useState<number | undefined>();

	useEffect(() => {
		const isMotion = new URLSearchParams(window.location.search).has("motion");
		setMotion(isMotion);
		setTake({
			run: 0,
			finished: isMotion ? 2 : 3,
			startedAt: Date.now() - (isMotion ? TAKE_ELAPSED : 4100),
		});
		if (!isMotion) return;

		let timeouts: number[] = [];
		const start = () => {
			for (const timeout of timeouts) window.clearTimeout(timeout);
			setEndedAt(undefined);
			// Remounted only to reset a finished take, so the first frame
			// already shows the timer.
			setTake((current) => ({
				run: current.finished === 2 ? current.run : current.run + 1,
				finished: 2,
				startedAt: Date.now() - TAKE_ELAPSED,
			}));
			timeouts = [
				...TAKE_FINISH.map((at, index) =>
					window.setTimeout(() => {
						setTake((current) => ({ ...current, finished: 3 + index }));
						if (index === TAKE_FINISH.length - 1) setEndedAt(Date.now());
					}, at),
				),
				window.setTimeout(start, TAKE_RESET),
			];
		};
		window.addEventListener("agent-thinking-capture", start);
		return () => {
			window.removeEventListener("agent-thinking-capture", start);
			for (const timeout of timeouts) window.clearTimeout(timeout);
		};
	}, []);

	if (motion === null) return null;
	const done = take.finished === STEPS.length;
	return (
		// The still is centered; the take starts at the top, so the opened log
		// ends up centered in the frame and its labels do not truncate.
		<div
			className={
				motion
					? "flex h-[184px] w-[260px] flex-col justify-start"
					: "flex h-[184px] w-[260px] flex-col items-center justify-center"
			}
		>
			<AgentThinking
				key={take.run}
				status={done ? "done" : "thinking"}
				steps={stepsFor(take.finished, take.run)}
				startedAt={take.startedAt}
				endedAt={done ? endedAt : undefined}
				className={motion ? undefined : "w-auto"}
			/>
		</div>
	);
}
