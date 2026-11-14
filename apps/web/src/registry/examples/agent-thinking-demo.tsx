"use client";

import {
	type ReactNode,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react";

import {
	AgentThinking,
	type AgentThinkingProps,
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
 * A scripted run on its own clock. It starts the first time it's on screen,
 * pauses while scrolled away or in a hidden tab, and stops at `endAt` (or
 * loops back to the start when `loop` is set).
 */
function useRun(endAt: number, events: number[], loop = false) {
	const ref = useRef<HTMLDivElement>(null);
	const active = useActive(ref);
	const [clock, setClock] = useState({ run: 0, elapsed: 0, epoch: 0 });
	const elapsedRef = useRef(0);
	const runRef = useRef(0);
	const [restarts, setRestarts] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: restarts re-runs the clock
	useEffect(() => {
		if (!active) return;
		let epoch = Date.now() - elapsedRef.current;
		let timeout = 0;
		const update = () => {
			let elapsed = Date.now() - epoch;
			if (loop && elapsed >= endAt + 1500) {
				runRef.current += 1;
				epoch = Date.now();
				elapsed = 0;
			}
			elapsedRef.current = Math.min(elapsed, endAt);
			setClock({ run: runRef.current, elapsed, epoch });
			const next = [...events, endAt + 1500].find((at) => at > elapsed);
			if (next !== undefined && (loop || next <= endAt)) {
				timeout = window.setTimeout(update, next - elapsed);
			}
		};
		update();
		return () => {
			window.clearTimeout(timeout);
			elapsedRef.current = Math.min(Date.now() - epoch, endAt);
		};
	}, [active, restarts]);

	const replay = () => {
		runRef.current += 1;
		elapsedRef.current = 0;
		setRestarts((count) => count + 1);
	};

	return { ref, replay, ...clock };
}

/** Props for the scripted run, failing on step `failAt` (1-based) if set. */
function runProps(
	{ run, elapsed, epoch }: { run: number; elapsed: number; epoch: number },
	failAt?: number,
): Pick<AgentThinkingProps, "status" | "steps" | "startedAt" | "endedAt"> {
	const last = failAt ?? STEPS.length;
	const finished = FINISH_AT.slice(0, last).filter(
		(at) => elapsed >= at,
	).length;
	const steps: AgentThinkingStep[] = STEPS.slice(
		0,
		Math.min(finished + 1, last),
	).map((label, index) => ({
		id: `${run}-${index}`,
		label,
		status:
			index < finished ? (failAt === index + 1 ? "error" : "done") : "active",
		durationMs:
			index < finished
				? FINISH_AT[index] - (FINISH_AT[index - 1] ?? 0)
				: undefined,
	}));
	const over = finished === last;
	return {
		status: over ? (failAt ? "error" : "done") : "thinking",
		steps,
		startedAt: epoch || undefined,
		endedAt: over && epoch ? epoch + FINISH_AT[last - 1] : undefined,
	};
}

function Section({
	title,
	hint,
	onReplay,
	children,
}: {
	title: string;
	hint?: string;
	onReplay?: () => void;
	children: ReactNode;
}) {
	return (
		<section className="flex w-full flex-col gap-3">
			<div className="flex items-center justify-between gap-3">
				<p className="font-medium text-muted-foreground text-xs">{title}</p>
				{onReplay ? (
					<button
						type="button"
						onClick={onReplay}
						className="inline-flex h-7 items-center rounded-md px-2 text-muted-foreground text-xs outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						Replay
					</button>
				) : null}
			</div>
			{children}
			{hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
		</section>
	);
}

function AgentThinkingDemo() {
	const end = FINISH_AT[STEPS.length - 1];
	const agent = useRun(end, FINISH_AT);
	const working = useRun(end, FINISH_AT);
	const quick = useRun(900, [900]);
	const small = useRun(end, FINISH_AT, true);
	const failing = useRun(FINISH_AT[2], FINISH_AT.slice(0, 3), true);

	return (
		<div className="flex w-full max-w-xs flex-col gap-10 py-4">
			<Section
				title="Agent run"
				hint="Click to see the steps"
				onReplay={agent.replay}
			>
				<div ref={agent.ref}>
					<AgentThinking {...runProps(agent)} />
				</div>
			</Section>

			<Section title="Open while working" onReplay={working.replay}>
				<div ref={working.ref}>
					<AgentThinking defaultOpen {...runProps(working)} />
				</div>
			</Section>

			<Section title="Quick answer" onReplay={quick.replay}>
				<div ref={quick.ref}>
					<AgentThinking
						key={quick.run}
						status={quick.elapsed >= 900 ? "done" : "thinking"}
						startedAt={quick.epoch || undefined}
						endedAt={
							quick.elapsed >= 900 && quick.epoch
								? quick.epoch + 900
								: undefined
						}
					/>
				</div>
			</Section>

			<Section title="Sizes and pill">
				<div ref={small.ref} className="flex flex-col gap-4">
					<AgentThinking size="sm" {...runProps(small)} />
					<AgentThinking variant="pill" {...runProps(small)} />
				</div>
				<div ref={failing.ref}>
					<AgentThinking variant="pill" {...runProps(failing, 3)} />
				</div>
			</Section>
		</div>
	);
}

export default AgentThinkingDemo;
