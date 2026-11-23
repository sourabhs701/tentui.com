"use client";

import { type ReactNode, useState } from "react";

import { RangeSpan } from "@/registry/components/range-span/range-span";

const priceMarks = [
	{ value: 0, label: "$0" },
	{ value: 250, label: "$250" },
	{ value: 500, label: "$500" },
	{ value: 750, label: "$750" },
	{ value: 1000, label: "$1k" },
];

const formatCurrency = (value: number) =>
	value >= 1000
		? `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
		: `$${value}`;

const formatHour = (value: number) => {
	const hours = Math.floor(value);
	const minutes = Math.round((value - hours) * 60);
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const presets: ReadonlyArray<{ label: string; value: [number, number] }> = [
	{ label: "Tight", value: [40, 60] },
	{ label: "Balanced", value: [20, 80] },
	{ label: "Full", value: [0, 100] },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full min-w-0 flex-col gap-3">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

function ControlledRange() {
	const [span, setSpan] = useState<[number, number]>([25, 75]);
	const [committed, setCommitted] = useState<string[]>([]);

	return (
		<div className="flex min-w-0 flex-col gap-3.5">
			<RangeSpan
				label="Exposure window"
				value={span}
				onValueChange={setSpan}
				onValueCommit={(next) =>
					setCommitted((list) => [`${next[0]}–${next[1]}`, ...list].slice(0, 3))
				}
				step={5}
			/>
			<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
				<div className="flex flex-wrap items-center gap-1.5">
					{presets.map((preset) => {
						const active =
							span[0] === preset.value[0] && span[1] === preset.value[1];
						return (
							<button
								key={preset.label}
								type="button"
								onClick={() => setSpan(preset.value)}
								className={
									active
										? "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-foreground px-3.5 font-medium text-background text-xs transition-[color,background-color,transform] duration-150 active:scale-[0.97] sm:min-h-8 sm:rounded-md sm:px-2.5"
										: "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-3.5 font-medium text-muted-foreground text-xs transition-[color,background-color,transform] duration-150 hover:text-foreground active:scale-[0.97] sm:min-h-8 sm:rounded-md sm:px-2.5"
								}
							>
								{preset.label}
							</button>
						);
					})}
				</div>
				<p className="min-h-4 text-muted-foreground text-xs tabular-nums leading-relaxed">
					{committed.length
						? `Committed: ${committed.join(", ")}`
						: "Release to commit"}
				</p>
			</div>
		</div>
	);
}

function RangeSpanDemo() {
	return (
		<div className="flex w-full max-w-sm flex-col gap-9 px-4 py-3 sm:gap-10 sm:px-5 sm:py-4">
			<Section title="Floating live labels with marks">
				<RangeSpan
					label="Budget"
					min={0}
					max={1000}
					step={25}
					minGap={50}
					defaultValue={[200, 750]}
					marks={priceMarks}
					format={formatCurrency}
				/>
			</Section>

			<Section title="Auto labels with minimum gap">
				<RangeSpan
					label="Active hours"
					liveLabels="auto"
					min={0}
					max={24}
					step={0.5}
					minGap={2}
					defaultValue={[9, 17]}
					format={formatHour}
				/>
			</Section>

			<Section title="Controlled with presets">
				<ControlledRange />
			</Section>

			<Section title="Compact header readout">
				<RangeSpan
					label="Temperature"
					liveLabels="header"
					size="sm"
					min={16}
					max={30}
					step={0.5}
					minGap={1}
					defaultValue={[19.5, 24]}
					format={(value) => `${value.toFixed(1)}°C`}
				/>
			</Section>

			<Section title="Disabled">
				<RangeSpan label="Locked range" defaultValue={[30, 70]} disabled />
			</Section>
		</div>
	);
}

export default RangeSpanDemo;
