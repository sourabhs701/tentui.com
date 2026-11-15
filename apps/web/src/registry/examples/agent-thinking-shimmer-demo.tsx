"use client";

import { useEffect, useRef, useState } from "react";

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

/**
 * A scripted run that starts the first time it's on screen and pauses while
 * scrolled away or in a hidden tab.
 */
function useRun() {
	const ref = useRef<HTMLDivElement>(null);
	const [clock, setClock] = useState({ elapsed: 0, epoch: 0 });

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		let elapsed = 0;
		let interval = 0;
		let onScreen = false;
		const update = () => {
			window.clearInterval(interval);
			if (!onScreen || document.visibilityState === "hidden") return;
			if (elapsed >= END) return;
			const epoch = Date.now() - elapsed;
			const tick = () => {
				elapsed = Math.min(Date.now() - epoch, END);
				if (elapsed >= END) window.clearInterval(interval);
				setClock({ elapsed, epoch });
			};
			tick();
			interval = window.setInterval(tick, 100);
		};
		const observer = new IntersectionObserver(([entry]) => {
			onScreen = entry?.isIntersecting ?? false;
			update();
		});
		observer.observe(element);
		document.addEventListener("visibilitychange", update);
		return () => {
			window.clearInterval(interval);
			observer.disconnect();
			document.removeEventListener("visibilitychange", update);
		};
	}, []);

	return { ref, ...clock };
}

/** Steps, status, and times for the run `elapsed` ms in. */
function runProps({ elapsed, epoch }: { elapsed: number; epoch: number }) {
	const finished = FINISH_AT.filter((at) => elapsed >= at).length;
	const steps: AgentThinkingStep[] = STEPS.slice(0, finished + 1).map(
		(label, index) => ({
			id: String(index),
			label,
			status: index < finished ? "done" : "active",
			durationMs:
				index < finished
					? FINISH_AT[index] - (FINISH_AT[index - 1] ?? 0)
					: undefined,
		}),
	);
	const done = finished === STEPS.length;
	return {
		status: done ? ("done" as const) : ("thinking" as const),
		steps,
		startedAt: epoch || undefined,
		endedAt: done && epoch ? epoch + END : undefined,
	};
}

export function AgentThinkingShimmerDemo() {
	const run = useRun();
	return (
		<div ref={run.ref} className="w-64 max-w-full">
			<AgentThinking variant="shimmer" {...runProps(run)} />
		</div>
	);
}

export default AgentThinkingShimmerDemo;
