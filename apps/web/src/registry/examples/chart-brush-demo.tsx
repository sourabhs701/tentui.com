"use client";

import { type ReactNode, useState } from "react";

import {
	ChartBrush,
	type ChartBrushRange,
} from "@/registry/components/chart-brush/chart-brush";

const utcDay = { month: "short", day: "numeric", timeZone: "UTC" } as const;
const formatDay = new Intl.DateTimeFormat("en-US", utcDay);

/** Twelve weeks of signups with a launch spike in week seven. */
const signups = Array.from({ length: 84 }, (_, day) => {
	const base = 420 + day * 3;
	const weekend = day % 7 >= 5 ? -45 : 0;
	const launch = 380 * Math.exp(-(((day - 46) / 4) ** 2));
	const jitter = Math.sin(day * 7.31) * 14;
	return {
		date: Date.UTC(2026, 8, 1 + day),
		value: Math.round(base + weekend + launch + jitter),
	};
});

/** Two days of p95 latency, hourly, after a cache fix lands on day two. */
const latency = Array.from({ length: 48 }, (_, hour) => {
	const daily = Math.sin(((hour - 8) / 24) * Math.PI * 2) * 22;
	const fix = hour > 26 ? -64 : 0;
	const jitter = Math.sin(hour * 4.17) * 5;
	return {
		date: Date.UTC(2026, 10, 18, hour),
		value: Math.round(212 + daily + fix + jitter),
	};
});

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col gap-3">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

function ControlledBrush() {
	const [range, setRange] = useState<ChartBrushRange>({ start: 42, end: 55 });
	const [committed, setCommitted] = useState<ChartBrushRange | null>(null);
	const days = signups.slice(range.start, range.end + 1);
	const total = days.reduce((sum, day) => sum + day.value, 0);

	return (
		<div className="flex flex-col gap-2">
			<ChartBrush
				label="Signups"
				data={signups}
				value={range}
				onValueChange={setRange}
				onValueCommit={setCommitted}
				minSpan={6}
				dateFormat={utcDay}
			/>
			<p className="min-h-4 text-muted-foreground text-xs tabular-nums">
				{total.toLocaleString("en-US")} signups from{" "}
				{formatDay.format(signups[range.start].date)} to{" "}
				{formatDay.format(signups[range.end].date)}
				{committed ? ` · saved ${committed.start}–${committed.end}` : ""}
			</p>
		</div>
	);
}

function ChartBrushDemo() {
	return (
		<div className="flex w-full max-w-md flex-col gap-10 py-4">
			<Section title="Controlled, at least a week selected">
				<ControlledBrush />
			</Section>
			<Section title="Line, where down is good">
				<ChartBrush
					label="p95 latency"
					data={latency}
					variant="line"
					positive="down"
					defaultValue={{ start: 14, end: 40 }}
					valueFormat={{
						style: "unit",
						unit: "millisecond",
						unitDisplay: "narrow",
						maximumFractionDigits: 0,
					}}
					dateFormat={{
						weekday: "short",
						hour: "numeric",
						timeZone: "UTC",
					}}
					height={140}
				/>
			</Section>
		</div>
	);
}

export default ChartBrushDemo;
