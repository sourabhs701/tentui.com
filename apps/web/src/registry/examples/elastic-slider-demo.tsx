"use client";

import { Sun, SunDim, Volume1, Volume2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import { ElasticSlider } from "@/registry/components/elastic-slider/elastic-slider";

const zoomMarks = [
	{ value: 0, label: "0" },
	{ value: 25, label: "25" },
	{ value: 50, label: "50" },
	{ value: 75, label: "75" },
	{ value: 100, label: "100" },
];

const percent = (value: number) => `${Math.round(value * 100)}%`;

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col gap-3">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

function ControlledSlider() {
	const [brightness, setBrightness] = useState(60);
	const [committed, setCommitted] = useState<number[]>([]);

	return (
		<div className="flex flex-col gap-2">
			<ElasticSlider
				label="Brightness"
				value={brightness}
				onValueChange={setBrightness}
				onValueCommit={(value) =>
					setCommitted((list) => [value, ...list].slice(0, 4))
				}
				step={5}
				startIcon={<SunDim />}
				endIcon={<Sun />}
			/>
			<p className="min-h-4 text-muted-foreground text-xs tabular-nums">
				{committed.length
					? `Committed: ${committed.join(", ")}`
					: "Release to commit"}
			</p>
		</div>
	);
}

function ElasticSliderDemo() {
	return (
		<div className="flex w-full max-w-sm flex-col gap-10 py-4">
			<Section title="Inline with icons">
				<ElasticSlider
					label="Volume"
					defaultValue={40}
					startIcon={<Volume1 />}
					endIcon={<Volume2 />}
				/>
			</Section>

			<Section title="Stacked with labelled marks">
				<ElasticSlider
					label="Zoom"
					variant="stacked"
					defaultValue={50}
					marks={zoomMarks}
					format={(value) => `${value}%`}
				/>
			</Section>

			<Section title="Continuous">
				<ElasticSlider
					label="Opacity"
					variant="stacked"
					min={0}
					max={1}
					step={0.01}
					defaultValue={0.8}
					format={percent}
				/>
			</Section>

			<Section title="Controlled">
				<ControlledSlider />
			</Section>

			<Section title="Disabled">
				<ElasticSlider label="Balance" defaultValue={50} disabled />
			</Section>
		</div>
	);
}

export default ElasticSliderDemo;
