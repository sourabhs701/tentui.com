"use client";

import { useState } from "react";

import {
	ContributionHeat,
	type ContributionHeatDay,
	type ContributionHeatSize,
	type ContributionHeatTone,
	type ContributionHeatVariant,
} from "@/registry/components/contribution-heat/contribution-heat";

const DEMO_MILESTONES: Record<string, { label: string; detail: string }> = {
	"2026-06-19": {
		label: "Core primitives",
		detail: "Published foundational gesture and focus hooks.",
	},
	"2026-07-17": {
		label: "Dark mode audit",
		detail: "Calibrated surface contrast and hairline borders.",
	},
	"2026-08-14": {
		label: "v2.4 release",
		detail: "Shipped registry validation and keyboard parity.",
	},
	"2026-09-18": {
		label: "Registry overhaul",
		detail: "Added automated type tables and source indexing.",
	},
	"2026-10-08": {
		label: "Motion springs pass",
		detail: "Tuned critically damped springs and reduced motion.",
	},
	"2026-10-29": {
		label: "v2.8 launch",
		detail: "Shipped six new interactive components.",
	},
	"2026-11-12": {
		label: "Sprint 1 ship",
		detail: "Rolled out automated preview captures and CDN media.",
	},
};

function buildDemoData(): ContributionHeatDay[] {
	const end = new Date(Date.UTC(2026, 10, 22));
	const totalDays = 26 * 7;
	const start = new Date(end.getTime() - (totalDays - 1) * 86_400_000);
	const rows: ContributionHeatDay[] = [];

	for (let i = 0; i < totalDays; i++) {
		const date = new Date(start.getTime() + i * 86_400_000);
		const iso = date.toISOString().slice(0, 10);
		const dow = date.getUTCDay();
		const week = Math.floor(i / 7);

		const hash = Math.sin(i * 19.317 + 41.91) * 43758.5453;
		const rand = hash - Math.floor(hash);
		const isWeekend = dow === 0 || dow === 6;
		const sprintWave = Math.sin((week / 4) * Math.PI) * 0.5 + 0.5;

		let count = 0;
		const milestone = DEMO_MILESTONES[iso];
		if (milestone) {
			count = 15 + (i % 6);
		} else if (isWeekend) {
			count = rand > 0.7 ? Math.ceil(rand * 4) : 0;
		} else if (rand > 0.16) {
			count = Math.max(1, Math.round(rand * 11 * (0.5 + sprintWave * 0.85)));
		}

		rows.push({
			date: iso,
			count,
			...(milestone ? { label: milestone.label } : {}),
		});
	}

	return rows;
}

const DEMO_DATA = buildDemoData();

const TONES: Array<{ id: ContributionHeatTone; label: string; dot: string }> = [
	{ id: "emerald", label: "Emerald", dot: "bg-emerald-500" },
	{ id: "graphite", label: "Graphite", dot: "bg-zinc-600 dark:bg-zinc-300" },
	{ id: "amber", label: "Amber", dot: "bg-amber-500" },
	{ id: "cobalt", label: "Cobalt", dot: "bg-blue-500" },
];

const SIZES: ContributionHeatSize[] = ["sm", "md", "lg"];
const VARIANTS: ContributionHeatVariant[] = ["card", "plain"];

export default function ContributionHeatDemo() {
	const [tone, setTone] = useState<ContributionHeatTone>("emerald");
	const [size, setSize] = useState<ContributionHeatSize>("md");
	const [variant, setVariant] = useState<ContributionHeatVariant>("card");
	const [loupe, setLoupe] = useState(true);
	const [selectedDay, setSelectedDay] = useState<ContributionHeatDay | null>(
		null,
	);

	const selectedMilestone = selectedDay
		? DEMO_MILESTONES[selectedDay.date]
		: undefined;

	return (
		<div className="flex w-full min-w-0 max-w-2xl flex-col items-center gap-5 px-2 py-4 sm:px-0">
			<div className="flex flex-wrap items-center justify-center gap-2 text-xs">
				<div
					role="group"
					aria-label="Color tone"
					className="inline-flex max-w-full flex-wrap items-center justify-center rounded-lg border border-border/80 bg-muted/40 p-0.5"
				>
					{TONES.map((item) => (
						<button
							key={item.id}
							type="button"
							aria-pressed={tone === item.id}
							onClick={() => setTone(item.id)}
							className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors duration-150 sm:min-h-7 ${
								tone === item.id
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							<span
								aria-hidden="true"
								className={`size-2 rounded-full ${item.dot}`}
							/>
							{item.label}
						</button>
					))}
				</div>

				<div
					role="group"
					aria-label="Size"
					className="inline-flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5"
				>
					{SIZES.map((item) => (
						<button
							key={item}
							type="button"
							aria-pressed={size === item}
							onClick={() => setSize(item)}
							className={`min-h-9 cursor-pointer rounded-md px-2.5 py-1 font-medium uppercase transition-colors duration-150 sm:min-h-7 sm:px-2 ${
								size === item
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							{item}
						</button>
					))}
				</div>

				<div
					role="group"
					aria-label="Container variant"
					className="inline-flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5"
				>
					{VARIANTS.map((item) => (
						<button
							key={item}
							type="button"
							aria-pressed={variant === item}
							onClick={() => setVariant(item)}
							className={`min-h-9 cursor-pointer rounded-md px-2.5 py-1 font-medium capitalize transition-colors duration-150 sm:min-h-7 ${
								variant === item
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							{item}
						</button>
					))}
				</div>

				<button
					type="button"
					aria-pressed={loupe}
					onClick={() => setLoupe((prev) => !prev)}
					className={`min-h-10 cursor-pointer rounded-lg border px-3 py-1.5 font-medium transition-colors duration-150 sm:min-h-8 sm:px-2.5 ${
						loupe
							? "border-border bg-background text-foreground shadow-xs"
							: "border-border/70 bg-muted/40 text-muted-foreground hover:text-foreground"
					}`}
				>
					Loupe {loupe ? "on" : "off"}
				</button>
			</div>

			<div className="flex w-full justify-center">
				<ContributionHeat
					aria-label="Repository commits over 26 weeks"
					data={DEMO_DATA}
					loupe={loupe}
					onValueChange={setSelectedDay}
					size={size}
					summaryLabel="Last 26 weeks"
					tone={tone}
					unit={["commit", "commits"]}
					value={selectedDay?.date ?? null}
					variant={variant}
					weeks={26}
				/>
			</div>

			<div className="flex min-h-11 w-full max-w-lg items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-3.5 py-2 text-muted-foreground text-xs">
				{selectedDay ? (
					<>
						<div className="min-w-0">
							<p className="truncate font-medium text-foreground tabular-nums">
								{selectedDay.date} &middot; {selectedDay.count}{" "}
								{selectedDay.count === 1 ? "commit" : "commits"}
								{selectedDay.label ? ` — ${selectedDay.label}` : ""}
							</p>
							<p className="truncate text-[11px] text-muted-foreground">
								{selectedMilestone
									? selectedMilestone.detail
									: selectedDay.count === 0
										? "Rest day with no recorded commits."
										: "Use arrow keys to step across neighboring days or press Escape to clear."}
							</p>
						</div>
						<button
							type="button"
							onClick={() => setSelectedDay(null)}
							className="min-h-9 shrink-0 cursor-pointer rounded-md border border-border/80 bg-background px-3 py-1 font-medium text-[11px] text-foreground transition-colors hover:bg-muted sm:min-h-7 sm:px-2"
						>
							Clear
						</button>
					</>
				) : (
					<p className="text-[11px]">
						Hover or tap any day to inspect and pin it, scroll across weeks on
						mobile, or tap a legend swatch to isolate an intensity level.
					</p>
				)}
			</div>
		</div>
	);
}
