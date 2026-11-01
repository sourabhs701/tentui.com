"use client";

import { Timer } from "lucide-react";
import { useEffect, useState } from "react";

import {
	DynamicIsland,
	DynamicIslandView,
} from "@/registry/components/dynamic-island/dynamic-island";

const START = 5 * 60;

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60);
	return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function DynamicIslandPreview() {
	const [view, setView] = useState<string | null>(null);
	const [seconds, setSeconds] = useState(START);
	const running = view !== null;

	useEffect(() => {
		if (!running) return;
		const timer = setInterval(
			() => setSeconds((current) => Math.max(0, current - 1)),
			1000,
		);
		return () => clearInterval(timer);
	}, [running]);

	const startTimer = () => {
		setSeconds(START);
		setView("timer");
	};

	const minutes = Math.floor(seconds / 60);

	return (
		<DynamicIsland
			view={view}
			onExpand={(id) => (id === null ? startTimer() : setView("done"))}
			onDismiss={() => setView(null)}
		>
			<DynamicIslandView
				id="timer"
				label={`Timer, ${minutes} minutes ${seconds % 60} seconds`}
				className="w-40"
			>
				<Timer aria-hidden className="size-4" />
				<span className="font-semibold tabular-nums">
					{formatTime(seconds)}
				</span>
			</DynamicIslandView>
			<DynamicIslandView id="done" size="expanded" label="Timer done">
				<div className="flex items-center gap-3">
					<span className="grid size-10 shrink-0 place-items-center rounded-full bg-background/15">
						<Timer aria-hidden className="size-5" />
					</span>
					<div className="min-w-0">
						<p className="font-semibold">Timer done</p>
						<p className="text-background/70">5 minutes are up.</p>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<button
						type="button"
						onClick={() => setView(null)}
						className="h-9 cursor-pointer rounded-full bg-background/15 font-medium outline-none transition-colors hover:bg-background/25 focus-visible:ring-2 focus-visible:ring-background/60"
					>
						Stop
					</button>
					<button
						type="button"
						onClick={startTimer}
						className="h-9 cursor-pointer rounded-full bg-background font-medium text-foreground outline-none transition-colors hover:bg-background/90 focus-visible:ring-2 focus-visible:ring-background/60 focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
					>
						Repeat
					</button>
				</div>
			</DynamicIslandView>
		</DynamicIsland>
	);
}

export default DynamicIslandPreview;
