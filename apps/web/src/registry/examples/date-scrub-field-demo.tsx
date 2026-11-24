"use client";

import { type ReactNode, useState } from "react";

import { DateScrubField } from "@/registry/components/date-scrub-field/date-scrub-field";

const PRESETS = [
	{ label: "Launch", iso: "2026-05-14" },
	{ label: "+1 week", iso: "2026-05-21" },
	{ label: "Month end", iso: "2026-05-31" },
	{ label: "Leap day", iso: "2028-02-29" },
] as const;

function Section({
	title,
	hint,
	children,
}: {
	title: string;
	hint?: string;
	children: ReactNode;
}) {
	return (
		<section className="flex w-full min-w-0 flex-col gap-2.5">
			<div className="flex flex-col gap-0.5">
				<p className="font-medium text-foreground text-xs">{title}</p>
				{hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
			</div>
			{children}
		</section>
	);
}

function ControlledReleaseCard() {
	const [iso, setIso] = useState("2026-05-14");
	const [committed, setCommitted] = useState<string[]>([]);

	return (
		<div className="flex min-w-0 flex-col gap-3.5 rounded-2xl border bg-card p-4 text-card-foreground shadow-xs sm:p-5">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="min-w-0">
					<p className="font-medium text-sm">Target milestone</p>
					<p className="text-muted-foreground text-xs">
						Drag any part, or click to type digits
					</p>
				</div>
				<span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
					{iso}
				</span>
			</div>

			<div className="pt-2">
				<DateScrubField
					label="Target milestone date"
					value={iso}
					onValueChange={(_, nextIso) => setIso(nextIso)}
					onValueCommit={(_, nextIso) =>
						setCommitted((items) => [nextIso, ...items].slice(0, 3))
					}
					wheel
				/>
			</div>

			<div className="flex flex-wrap items-center gap-1.5">
				{PRESETS.map((preset) => {
					const active = iso === preset.iso;
					return (
						<button
							key={preset.label}
							type="button"
							onClick={() => setIso(preset.iso)}
							className={
								active
									? "inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg bg-foreground px-3 font-medium text-background text-xs transition-[color,background-color,transform] duration-150 active:scale-[0.97] sm:min-h-7 sm:rounded-md sm:px-2.5"
									: "inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-3 font-medium text-muted-foreground text-xs transition-[color,background-color,transform] duration-150 hover:text-foreground active:scale-[0.97] sm:min-h-7 sm:rounded-md sm:px-2.5"
							}
						>
							{preset.label}
						</button>
					);
				})}
			</div>

			<p className="min-h-4 text-muted-foreground text-xs tabular-nums">
				{committed.length > 0
					? `Committed: ${committed.join(", ")}`
					: "Release a scrub or press arrows to commit"}
			</p>
		</div>
	);
}

function DateScrubFieldDemo() {
	return (
		<div className="flex w-full max-w-md flex-col gap-7 px-3 py-4 sm:gap-8 sm:px-5">
			<ControlledReleaseCard />

			<Section
				title="Bounded window (rubber-band limits)"
				hint="Constrained to May 10 – May 20, 2026. Pull past either edge to feel resistance."
			>
				<DateScrubField
					label="Sprint window"
					defaultValue="2026-05-14"
					min="2026-05-10"
					max="2026-05-20"
					variant="filled"
				/>
			</Section>

			<Section
				title="Orders & formats"
				hint="Supports European day-first and ISO numeric formats."
			>
				<div className="flex flex-wrap items-center gap-3">
					<DateScrubField
						label="European date"
						defaultValue="2026-05-14"
						order="dmy"
						locale="en-GB"
						size="sm"
					/>
					<DateScrubField
						label="ISO numeric date"
						defaultValue="2026-05-14"
						order="ymd"
						monthFormat="2-digit"
						showWeekday={false}
						size="sm"
					/>
				</div>
			</Section>

			<Section title="Ghost & disabled">
				<div className="flex flex-wrap items-center gap-4">
					<DateScrubField
						label="Inline due date"
						defaultValue="2026-09-08"
						variant="ghost"
					/>
					<DateScrubField
						label="Locked date"
						defaultValue="2026-05-14"
						size="sm"
						disabled
					/>
				</div>
			</Section>
		</div>
	);
}

export default DateScrubFieldDemo;
