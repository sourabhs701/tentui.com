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
/** Ms into the run each step finishes; the last one ends the run. */
const FINISH_AT = [1000, 2200, 3300, 4400, 5500];
const END = FINISH_AT[FINISH_AT.length - 1];
/** Ms into the take it resets to its first frame, so the clip loops. */
const TAKE_RESET = 7300;
/** The still is a run this far in: three steps landed and the timer at "3s". */
const STILL_AT = 3600;

const REASONING =
	"The question is how to show tool calls while the answer streams. The AI SDK docs cover useChat and streamText, so I'll start there. Three sources disagree on when a tool result is merged; the v5 changelog settles it. In the code, message.parts carries every tool call with its state, so each one maps straight to a step.";
const WORDS = REASONING.split(" ");

function runAt(elapsed: number, run: number) {
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
	// The first words arrive a moment in, and the last just before the end.
	const words = Math.ceil((WORDS.length * (elapsed - 400)) / (END - 800));
	return {
		done: finished === STEPS.length,
		steps,
		reasoning: WORDS.slice(0, Math.max(0, Math.min(words, WORDS.length))).join(
			" ",
		),
	};
}

/**
 * Four looks in sync: the dot cluster, the shimmer line, the orb in a chat
 * bubble, and the reasoning card. The still is a run in progress. Motion
 * takes load the page with `?motion`, and the video scenario dispatches
 * `agent-thinking-capture` to start a run from its first, quiet frame on the
 * virtual clock: steps land, the card streams, and all four finish together.
 */
export function AgentThinkingCapture() {
	const [motion, setMotion] = useState<boolean | null>(null);
	const [take, setTake] = useState({ run: 0, epoch: 0, elapsed: 0 });

	useEffect(() => {
		const isMotion = new URLSearchParams(window.location.search).has("motion");
		setMotion(isMotion);
		const elapsed = isMotion ? 0 : STILL_AT;
		setTake({ run: 0, epoch: Date.now() - elapsed, elapsed });
		if (!isMotion) return;

		let interval = 0;
		const start = () => {
			window.clearInterval(interval);
			const epoch = Date.now();
			setTake((current) => ({ run: current.run + 1, epoch, elapsed: 0 }));
			interval = window.setInterval(() => {
				const elapsed = Date.now() - epoch;
				if (elapsed >= TAKE_RESET) {
					start();
					return;
				}
				setTake((current) => ({ ...current, elapsed }));
			}, 50);
		};
		window.addEventListener("agent-thinking-capture", start);
		return () => {
			window.removeEventListener("agent-thinking-capture", start);
			window.clearInterval(interval);
		};
	}, []);

	if (motion === null) return null;
	const { run, epoch, elapsed } = take;
	const { done, steps, reasoning } = runAt(elapsed, run);
	const shared = {
		status: done ? ("done" as const) : ("thinking" as const),
		startedAt: epoch,
		endedAt: done ? epoch + END : undefined,
	};
	return (
		// As tall as the run, so nothing moves as the card unfolds and folds.
		<div className="flex h-68 w-72 flex-col gap-4">
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
