"use client";

import { BellOff, Coffee } from "lucide-react";
import { type ReactNode, useState } from "react";

import {
	TimeRing,
	type TimeRingValue,
} from "@/registry/components/time-ring/time-ring";

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

function formatTime(minutes: number) {
	const hours = Math.floor(minutes / 60);
	return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function TimeRingDemo() {
	const [sleep, setSleep] = useState<TimeRingValue>({
		start: 22 * 60 + 30,
		end: 6 * 60 + 45,
	});

	return (
		<div className="flex w-full max-w-md flex-col items-center gap-10 py-4">
			<Section title="Controlled, 15 minute steps, 6 to 10 hours">
				<TimeRing
					aria-label="Sleep schedule"
					value={sleep}
					onValueChange={setSleep}
					step={15}
					minDuration={6 * 60}
					maxDuration={10 * 60}
				/>
				<p className="text-muted-foreground text-xs tabular-nums">
					start {formatTime(sleep.start)} · end {formatTime(sleep.end)}
				</p>
			</Section>

			<Section title="24-hour clock, custom icons and labels">
				<TimeRing
					aria-label="Do not disturb"
					size="sm"
					format="24h"
					step={30}
					defaultValue={{ start: 9 * 60, end: 17 * 60 + 30 }}
					startIcon={<BellOff />}
					endIcon={<Coffee />}
					startLabel="Quiet from"
					endLabel="Quiet until"
					className="[--time-ring-accent:var(--color-sky-500)]"
				/>
			</Section>
		</div>
	);
}

export default TimeRingDemo;
