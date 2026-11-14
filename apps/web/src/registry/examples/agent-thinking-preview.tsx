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
/** Ms into the run the next one starts, after a short hold on the done state. */
const LOOP_AT = 7000;

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
 * A scripted agent run on its own clock: it only advances while `active`, so
 * scrolling away or hiding the tab pauses it, and `epoch` shifts to match.
 */
function useRunClock(active: boolean) {
	const [clock, setClock] = useState({ run: 0, elapsed: 0, epoch: 0 });
	const elapsedRef = useRef(0);
	const runRef = useRef(0);

	useEffect(() => {
		if (!active) return;
		let epoch = Date.now() - elapsedRef.current;
		let timeout = 0;
		const update = () => {
			let elapsed = Date.now() - epoch;
			if (elapsed >= LOOP_AT) {
				runRef.current += 1;
				epoch = Date.now();
				elapsed = 0;
			}
			elapsedRef.current = elapsed;
			setClock({ run: runRef.current, elapsed, epoch });
			const next =
				[...FINISH_AT, LOOP_AT].find((at) => at > elapsed) ?? LOOP_AT;
			timeout = window.setTimeout(update, next - elapsed);
		};
		update();
		return () => {
			window.clearTimeout(timeout);
			elapsedRef.current = Date.now() - epoch;
		};
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

	return (
		<div ref={ref} className="w-60 max-w-full">
			<AgentThinking
				status={done ? "done" : "thinking"}
				steps={steps}
				startedAt={epoch || undefined}
				endedAt={
					done && epoch ? epoch + FINISH_AT[STEPS.length - 1] : undefined
				}
			/>
		</div>
	);
}

export default AgentThinkingPreview;
