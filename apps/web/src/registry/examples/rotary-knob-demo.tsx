"use client";

import type { ReactNode } from "react";

import { RotaryKnob } from "@/registry/components/rotary-knob/rotary-knob";

const fanStops = [
	{ value: 0, label: "Off" },
	{ value: 1, label: "Low" },
	{ value: 2, label: "Med" },
	{ value: 3, label: "High" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex w-full flex-col items-center gap-4">
			<p className="font-medium text-muted-foreground text-xs">{title}</p>
			{children}
		</section>
	);
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex flex-col items-center gap-1.5">
			{children}
			<span className="text-muted-foreground text-xs">{label}</span>
		</div>
	);
}

function RotaryKnobDemo() {
	return (
		<div className="flex w-full max-w-md flex-col items-center gap-10 py-4">
			<Section title="Labelled stops">
				<RotaryKnob
					aria-label="Fan speed"
					stops={fanStops}
					defaultValue={1}
					angleRange={240}
					showValue
				/>
			</Section>

			<Section title="Continuous, stepped, and circular">
				<div className="flex flex-wrap justify-center gap-6">
					<Labelled label="Level">
						<RotaryKnob
							aria-label="Level"
							size="sm"
							defaultValue={64}
							showValue
						/>
					</Labelled>
					<Labelled label="Step 5">
						<RotaryKnob
							aria-label="Mix"
							size="sm"
							step={5}
							defaultValue={25}
							showValue
						/>
					</Labelled>
					<Labelled label="Circular">
						<RotaryKnob
							aria-label="Hue"
							size="sm"
							max={360}
							defaultValue={210}
							angleRange={360}
							dragMode="circular"
							formatValue={(value) => `${value}°`}
							showValue
						/>
					</Labelled>
				</div>
			</Section>

			<Section title="Variants">
				<div className="flex flex-wrap justify-center gap-6">
					<Labelled label="Default">
						<RotaryKnob aria-label="Default" defaultValue={30} />
					</Labelled>
					<Labelled label="Minimal">
						<RotaryKnob
							aria-label="Minimal"
							variant="minimal"
							defaultValue={50}
						/>
					</Labelled>
					<Labelled label="Tactile">
						<RotaryKnob
							aria-label="Tactile"
							variant="tactile"
							defaultValue={70}
						/>
					</Labelled>
				</div>
			</Section>
		</div>
	);
}

export default RotaryKnobDemo;
